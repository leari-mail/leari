mod commands;
mod credentials;
mod db;
mod error;
mod mail;
mod notify;
mod oauth;
mod sync;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // A second launch just brings the existing window forward.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show(app);
        }));
    }

    builder
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // No dock icon by default: leari lives in the menu bar (macOS) / system tray.
            // The "Show in Dock" setting switches it at runtime (window::set_dock_visible).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            app.manage(sync::SyncEngine::new(app.handle().clone()));
            app.manage(oauth::OAuthState::default());
            tray::setup(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::sync_start,
            commands::sync_now,
            commands::sync_push,
            commands::sync_statuses,
            commands::credentials_set_password,
            commands::credentials_delete,
            commands::imap_test_connection,
            commands::pop3_test_connection,
            commands::oauth_providers,
            commands::oauth_sign_in,
            commands::oauth_cancel,
            commands::oauth_attach,
            commands::mail_send,
            commands::attachment_open,
            commands::attachment_save,
            commands::message_inline_images,
            commands::attachments_pick,
            commands::attachments_stat,
            commands::tray_set_unread,
            commands::notifications_configure,
            commands::app_set_dock_visible,
            commands::mailbox_create,
            commands::mailbox_rename,
            commands::mailbox_delete,
        ])
        .on_window_event(window::handle_event)
        .build(tauri::generate_context!())
        .expect("error while building leari")
        .run(|app, event| {
            // Clicking the Dock icon (when shown in the Dock) brings the hidden window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                window::show(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
