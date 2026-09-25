use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter,
};

use crate::window;

const TRAY_ID: &str = "main";
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray-icon.png");
/// Same bird with a dot, shown while any account is syncing.
const TRAY_ICON_SYNCING: &[u8] = include_bytes!("../icons/tray-icon-sync.png");

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open leari", true, None::<&str>)?;
    let compose = MenuItem::with_id(app, "compose", "New Message", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit leari", true, Some("CmdOrCtrl+Q"))?;
    let menu =
        Menu::with_items(app, &[&open, &compose, &PredefinedMenuItem::separator(app)?, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(TRAY_ICON)?)
        .icon_as_template(true)
        .tooltip("leari")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => window::show(app),
            "compose" => {
                window::show(app);
                let _ = app.emit("tray://compose", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::toggle(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Reflects sync activity in the menu bar / tray icon and its tooltip.
pub fn set_syncing(app: &AppHandle, syncing: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let bytes = if syncing { TRAY_ICON_SYNCING } else { TRAY_ICON };
    if let Ok(icon) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(icon));
        // Replacing the image resets the template flag on macOS.
        let _ = tray.set_icon_as_template(true);
    }
    let _ = tray.set_tooltip(Some(if syncing { "leari — syncing…" } else { "leari" }));
}
