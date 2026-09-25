use serde::{Deserialize, Serialize};

/// OAuth client credentials are injected at build time (see build.rs and `.env.example`),
/// so they never live in the repository.
const GOOGLE_CLIENT_ID: Option<&str> = option_env!("LEARI_GOOGLE_CLIENT_ID");
/// Google requires the secret of "Desktop app" clients in the token exchange; for installed
/// apps it is not confidential (see Google's OAuth docs for native apps).
const GOOGLE_CLIENT_SECRET: Option<&str> = option_env!("LEARI_GOOGLE_CLIENT_SECRET");
const MICROSOFT_CLIENT_ID: Option<&str> = option_env!("LEARI_MICROSOFT_CLIENT_ID");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Google,
    Microsoft,
}

pub struct ProviderConfig {
    pub auth_url: &'static str,
    pub token_url: &'static str,
    pub scopes: &'static str,
    pub client_id: &'static str,
    pub client_secret: Option<&'static str>,
    /// Host used in the loopback redirect URI (each provider documents its own).
    pub redirect_host: &'static str,
    pub extra_auth_params: &'static [(&'static str, &'static str)],
}

fn configured(value: Option<&'static str>) -> Option<&'static str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

impl Provider {
    pub const ALL: [Provider; 2] = [Provider::Google, Provider::Microsoft];

    /// The value stored in `accounts.provider`.
    pub fn from_account(provider: &str) -> Option<Self> {
        match provider {
            "google" => Some(Provider::Google),
            "microsoft" => Some(Provider::Microsoft),
            _ => None,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Provider::Google => "Google",
            Provider::Microsoft => "Microsoft",
        }
    }

    /// `None` when this build has no client id for the provider.
    pub fn config(self) -> Option<ProviderConfig> {
        match self {
            Provider::Google => Some(ProviderConfig {
                auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
                token_url: "https://oauth2.googleapis.com/token",
                scopes: "https://mail.google.com/ openid email profile",
                client_id: configured(GOOGLE_CLIENT_ID)?,
                client_secret: configured(GOOGLE_CLIENT_SECRET),
                redirect_host: "127.0.0.1",
                // Always return a refresh token, even when the user signed in before.
                extra_auth_params: &[("access_type", "offline"), ("prompt", "consent")],
            }),
            Provider::Microsoft => Some(ProviderConfig {
                auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                scopes: "https://outlook.office.com/IMAP.AccessAsUser.All \
                         https://outlook.office.com/SMTP.Send offline_access openid email profile",
                client_id: configured(MICROSOFT_CLIENT_ID)?,
                client_secret: None,
                redirect_host: "localhost",
                extra_auth_params: &[("prompt", "select_account"), ("response_mode", "query")],
            }),
        }
    }
}
