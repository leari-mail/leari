mod tray;
mod window;

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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // No dock icon: leari lives in the menu bar (macOS) / system tray.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(window::handle_event)
        .run(tauri::generate_context!())
        .expect("error while running leari");
}
