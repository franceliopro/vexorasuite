// The shell deliberately registers no Rust commands and contains no business
// logic. The canonical application remains apps/web, loaded in the webview.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
