use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};

pub const MAIN_WINDOW: &str = "main";

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW)
}

pub fn show(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn toggle(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);

    if visible && focused {
        let _ = window.hide();
    } else {
        show(app);
    }
}

/// Shows or hides leari in the Dock (macOS) / taskbar (Windows, Linux). Off by default:
/// leari lives in the menu bar / tray.
pub fn set_dock_visible(app: &AppHandle, visible: bool) {
    static DOCK_VISIBLE: AtomicBool = AtomicBool::new(false);
    if DOCK_VISIBLE.swap(visible, Ordering::SeqCst) == visible {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        use tauri::ActivationPolicy;
        let policy = if visible { ActivationPolicy::Regular } else { ActivationPolicy::Accessory };
        let _ = app.set_activation_policy(policy);
        // Changing the policy deactivates the app; keep an open window in front.
        if let Some(window) = main_window(app) {
            if window.is_visible().unwrap_or(false) {
                show(app);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(window) = main_window(app) {
        let _ = window.set_skip_taskbar(!visible);
    }
}

/// Closing the window only hides it: leari lives in the menu bar / tray
/// and is quit explicitly from the tray menu.
pub fn handle_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == MAIN_WINDOW {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}
