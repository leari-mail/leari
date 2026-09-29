use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::Duration;

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Wry,
};

use crate::window;

const TRAY_ID: &str = "main";
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray-icon.png");
/// Same bird with a dot, shown while any account is syncing.
const TRAY_ICON_SYNCING: &[u8] = include_bytes!("../icons/tray-icon-sync.png");
/// Keeping the left button down this long opens the menu instead of the window.
const HOLD_FOR_MENU: Duration = Duration::from_millis(450);

static MENU: OnceLock<Menu<Wry>> = OnceLock::new();
/// Set when an item of the tray menu is picked, to tell a pick from a dismissal.
static MENU_PICKED: AtomicBool = AtomicBool::new(false);

/// Menu bar / tray icon. On macOS and Windows a click opens (or hides) the window, and holding
/// the button or right-clicking opens the menu. Linux trays only support opening the menu.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Leari", true, None::<&str>)?;
    let compose = MenuItem::with_id(app, "compose", "New Message", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Leari", true, Some("CmdOrCtrl+Q"))?;
    let menu =
        Menu::with_items(app, &[&open, &compose, &PredefinedMenuItem::separator(app)?, &quit])?;

    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(TRAY_ICON)?)
        .icon_as_template(true)
        .tooltip("Leari")
        .on_menu_event(|app, event| {
            MENU_PICKED.store(true, Ordering::SeqCst);
            match event.id.as_ref() {
                "open" => window::show(app),
                "compose" => {
                    window::show(app);
                    let _ = app.emit("tray://compose", ());
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| on_icon_event(tray.app_handle(), event));
    // A menu attached to the macOS status item opens on every click, before the click reaches
    // us, so there it is only attached while it is shown (see `show_menu`).
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let builder = builder.menu(&menu);
    builder.build(app)?;
    let _ = MENU.set(menu);

    Ok(())
}

fn on_icon_event(app: &AppHandle, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Right,
            button_state: MouseButtonState::Down,
            ..
        } => show_menu(app),
        // macOS reports the release together with the press, so the button itself is watched.
        #[cfg(target_os = "macos")]
        TrayIconEvent::Enter { .. }
        | TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Down,
            ..
        } => hold::watch(app),
        #[cfg(target_os = "macos")]
        TrayIconEvent::Leave { .. } => hold::stop(),
        #[cfg(not(target_os = "macos"))]
        TrayIconEvent::Click { button: MouseButton::Left, button_state, .. } => {
            match button_state {
                MouseButtonState::Down => click::press(app),
                MouseButtonState::Up => click::release(app),
            }
        }
        _ => {}
    }
}

/// Pops up the tray menu under the icon (macOS, Windows) and returns once it closes. The popup
/// is modal, so the menu is detached again afterwards.
fn show_menu(app: &AppHandle) {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        let (Some(tray), Some(menu)) = (app.tray_by_id(TRAY_ID), MENU.get()) else { return };
        MENU_PICKED.store(false, Ordering::SeqCst);
        let _ = tray.set_menu(Some(menu.clone()));
        let _ = tray.with_inner_tray_icon(|inner| inner.show_menu());
        let _ = tray.set_menu(None::<Menu<Wry>>);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let _ = app;
}

/// Windows reports press and release as they happen: a timer tells a click from a hold.
#[cfg(not(target_os = "macos"))]
mod click {
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

    use tauri::AppHandle;

    use super::{show_menu, HOLD_FOR_MENU};
    use crate::window;

    static PRESS: AtomicU64 = AtomicU64::new(0);
    static PRESSED: AtomicBool = AtomicBool::new(false);
    /// Set once a press turned into the menu, so its release doesn't also toggle the window.
    static HELD: AtomicBool = AtomicBool::new(false);

    pub fn press(app: &AppHandle) {
        let id = PRESS.fetch_add(1, Ordering::SeqCst) + 1;
        PRESSED.store(true, Ordering::SeqCst);
        HELD.store(false, Ordering::SeqCst);
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(HOLD_FOR_MENU);
            let held = PRESSED.load(Ordering::SeqCst) && PRESS.load(Ordering::SeqCst) == id;
            if held && !HELD.swap(true, Ordering::SeqCst) {
                show_menu(&app);
            }
        });
    }

    pub fn release(app: &AppHandle) {
        PRESSED.store(false, Ordering::SeqCst);
        if !HELD.swap(true, Ordering::SeqCst) {
            window::toggle(app);
        }
    }
}

/// While the pointer is over the icon, a thread watches the left button: a short press toggles
/// the window, holding it opens the menu. Both run on the main dispatch queue, which keeps
/// running while the menu bar tracks the mouse (the app's own event loop doesn't).
#[cfg(target_os = "macos")]
mod hold {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::{Duration, Instant};

    use dispatch2::DispatchQueue;
    use objc2_core_graphics::{CGEventSource, CGEventSourceStateID, CGMouseButton};
    use tauri::AppHandle;

    use super::{show_menu, HOLD_FOR_MENU, MENU_PICKED, TRAY_ID};
    use crate::window;

    const POLL: Duration = Duration::from_millis(15);
    static HOVERING: AtomicBool = AtomicBool::new(false);
    static WATCHING: AtomicBool = AtomicBool::new(false);

    fn button_down() -> bool {
        CGEventSource::button_state(CGEventSourceStateID::CombinedSessionState, CGMouseButton::Left)
    }

    fn on_main(app: &AppHandle, f: fn(&AppHandle)) {
        let app = app.clone();
        DispatchQueue::main().exec_async(move || f(&app));
    }

    pub fn watch(app: &AppHandle) {
        HOVERING.store(true, Ordering::SeqCst);
        if WATCHING.swap(true, Ordering::SeqCst) {
            return;
        }
        let app = app.clone();
        std::thread::spawn(move || loop {
            let (mut pressed_at, mut held) = (None::<Instant>, false);
            while HOVERING.load(Ordering::SeqCst) || pressed_at.is_some() {
                match (button_down(), pressed_at) {
                    (true, None) => (pressed_at, held) = (Some(Instant::now()), false),
                    (true, Some(at)) if !held && at.elapsed() >= HOLD_FOR_MENU => {
                        held = true;
                        on_main(&app, open_menu);
                    }
                    (false, Some(_)) => {
                        pressed_at = None;
                        if !held {
                            on_main(&app, window::toggle);
                        }
                    }
                    _ => {}
                }
                std::thread::sleep(POLL);
            }
            WATCHING.store(false, Ordering::SeqCst);
            // The pointer may have come back between the last check and now.
            if !HOVERING.load(Ordering::SeqCst) || WATCHING.swap(true, Ordering::SeqCst) {
                break;
            }
        });
    }

    pub fn stop() {
        HOVERING.store(false, Ordering::SeqCst);
    }

    /// Opened mid-press, the menu closes when the button is released over the icon. Like the
    /// Dock, it then opens again and stays open until something is picked or it is dismissed.
    fn open_menu(app: &AppHandle) {
        show_menu(app);
        if !MENU_PICKED.load(Ordering::SeqCst) && !button_down() && pointer_over_icon(app) {
            show_menu(app);
        }
    }

    fn pointer_over_icon(app: &AppHandle) -> bool {
        let (Some(tray), Ok(cursor)) = (app.tray_by_id(TRAY_ID), app.cursor_position()) else {
            return false;
        };
        let Ok(Some(rect)) = tray.rect() else { return false };
        let scale = app.primary_monitor().ok().flatten().map_or(1.0, |m| m.scale_factor());
        let (pos, size) =
            (rect.position.to_physical::<f64>(scale), rect.size.to_physical::<f64>(scale));
        (pos.x..=pos.x + size.width).contains(&cursor.x)
            && (pos.y..=pos.y + size.height).contains(&cursor.y)
    }
}

#[derive(Default, Clone, Copy)]
struct TrayState {
    syncing: bool,
    unread: u32,
}

fn state() -> MutexGuard<'static, TrayState> {
    static STATE: Mutex<TrayState> = Mutex::new(TrayState { syncing: false, unread: 0 });
    STATE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn tooltip(state: TrayState) -> String {
    let mut parts = vec!["Leari".to_owned()];
    if state.unread > 0 {
        parts.push(format!("{} unread", state.unread));
    }
    if state.syncing {
        parts.push("syncing…".to_owned());
    }
    parts.join(" — ")
}

/// Reflects sync activity in the menu bar / tray icon and its tooltip.
pub fn set_syncing(app: &AppHandle, syncing: bool) {
    let current = {
        let mut state = state();
        state.syncing = syncing;
        *state
    };
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let bytes = if syncing { TRAY_ICON_SYNCING } else { TRAY_ICON };
    if let Ok(icon) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(icon));
        // Replacing the image resets the template flag on macOS.
        let _ = tray.set_icon_as_template(true);
    }
    let _ = tray.set_tooltip(Some(tooltip(current)));
}

/// Unread count next to the icon (macOS menu bar, Linux indicators) and in the tooltip.
pub fn set_unread(app: &AppHandle, unread: u32) {
    let current = {
        let mut state = state();
        state.unread = unread;
        *state
    };
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let title =
        (unread > 0).then(|| if unread > 999 { "999+".to_owned() } else { unread.to_string() });
    let _ = tray.set_title(title);
    let _ = tray.set_tooltip(Some(tooltip(current)));
}
