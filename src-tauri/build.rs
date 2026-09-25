/// Build-time configuration read by `option_env!` (see src/oauth/providers.rs).
const BUILD_ENV: [&str; 3] =
    ["LEARI_GOOGLE_CLIENT_ID", "LEARI_GOOGLE_CLIENT_SECRET", "LEARI_MICROSOFT_CLIENT_ID"];

/// For local builds, values can live in `.env.local` at the repository root (git-ignored).
/// Variables already set in the environment (e.g. CI secrets) take precedence.
fn load_env_file() {
    let path = std::path::Path::new("../.env.local");
    println!("cargo:rerun-if-changed={}", path.display());
    let Ok(contents) = std::fs::read_to_string(path) else { return };

    for line in contents.lines() {
        let Some((key, value)) = line.split_once('=') else { continue };
        let key = key.trim();
        if BUILD_ENV.contains(&key) && std::env::var(key).is_err() {
            let value = value.trim().trim_matches('"').trim_matches('\'');
            println!("cargo:rustc-env={key}={value}");
        }
    }
}

fn main() {
    for key in BUILD_ENV {
        println!("cargo:rerun-if-env-changed={key}");
    }
    load_env_file();
    tauri_build::build()
}
