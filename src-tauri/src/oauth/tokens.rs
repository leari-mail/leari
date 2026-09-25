use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};

use super::providers::ProviderConfig;
use crate::db::now_ms;
use crate::error::{Error, Result};

/// Stored (as JSON) in the OS keychain for OAuth accounts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenSet {
    pub access_token: String,
    pub refresh_token: String,
    /// Milliseconds since the epoch.
    pub expires_at: i64,
}

/// Refresh a bit early so a token never expires mid-sync.
const EXPIRY_MARGIN_MS: i64 = 2 * 60 * 1000;

impl TokenSet {
    pub fn is_fresh(&self) -> bool {
        self.expires_at - EXPIRY_MARGIN_MS > now_ms()
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Identity {
    pub email: String,
    pub name: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
    id_token: Option<String>,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct Claims {
    email: Option<String>,
    preferred_username: Option<String>,
    name: Option<String>,
}

/// Reads the signed-in user from the ID token. It comes straight from the provider's token
/// endpoint over TLS, so the signature does not need to be verified here.
pub fn identity_from_id_token(id_token: &str) -> Option<Identity> {
    let payload = id_token.split('.').nth(1)?;
    let claims: Claims = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(payload).ok()?).ok()?;
    let email = claims.email.or(claims.preferred_username).filter(|email| email.contains('@'))?;
    Some(Identity {
        email: email.to_lowercase(),
        name: claims.name.filter(|name| !name.is_empty()),
    })
}

fn http() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(concat!("leari/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| Error::Network(error.to_string()))
}

async fn request(config: &ProviderConfig, form: &[(&str, &str)]) -> Result<TokenResponse> {
    let mut form = form.to_vec();
    form.push(("client_id", config.client_id));
    if let Some(secret) = config.client_secret {
        form.push(("client_secret", secret));
    }

    let response = http()?
        .post(config.token_url)
        .form(&form)
        .send()
        .await
        .map_err(|error| Error::Network(error.to_string()))?;

    let status = response.status();
    let body = response.bytes().await.map_err(|error| Error::Network(error.to_string()))?;
    if status.is_success() {
        return serde_json::from_slice(&body)
            .map_err(|error| Error::Protocol(format!("unexpected token response: {error}")));
    }

    match serde_json::from_slice::<ErrorResponse>(&body) {
        // The refresh token was revoked or expired: the user has to sign in again.
        Ok(error) if error.error == "invalid_grant" => {
            Err(Error::Auth("sign-in expired, please sign in again".into()))
        }
        Ok(error) => Err(Error::Auth(
            format!("{} {}", error.error, error.error_description.unwrap_or_default())
                .trim()
                .to_owned(),
        )),
        Err(_) => Err(Error::Protocol(format!("token endpoint returned {status}"))),
    }
}

pub async fn exchange_code(
    config: &ProviderConfig,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<(TokenSet, Option<Identity>)> {
    let response = request(
        config,
        &[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("code_verifier", verifier),
            ("redirect_uri", redirect_uri),
        ],
    )
    .await?;

    let refresh_token = response
        .refresh_token
        .ok_or_else(|| Error::Auth("the provider did not grant offline access".into()))?;
    let identity = response.id_token.as_deref().and_then(identity_from_id_token);
    Ok((
        TokenSet {
            access_token: response.access_token,
            refresh_token,
            expires_at: now_ms() + response.expires_in * 1000,
        },
        identity,
    ))
}

pub async fn refresh(config: &ProviderConfig, tokens: &TokenSet) -> Result<TokenSet> {
    let response = request(
        config,
        &[("grant_type", "refresh_token"), ("refresh_token", &tokens.refresh_token)],
    )
    .await?;
    Ok(TokenSet {
        access_token: response.access_token,
        // Microsoft rotates refresh tokens; Google keeps the original one.
        refresh_token: response.refresh_token.unwrap_or_else(|| tokens.refresh_token.clone()),
        expires_at: now_ms() + response.expires_in * 1000,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn jwt(claims: &str) -> String {
        format!("e30.{}.sig", URL_SAFE_NO_PAD.encode(claims))
    }

    #[test]
    fn reads_google_and_microsoft_identities() {
        let google = identity_from_id_token(&jwt(r#"{"email":"Ana@Gmail.com","name":"Ana"}"#));
        let google = google.unwrap();
        assert_eq!(google.email, "ana@gmail.com");
        assert_eq!(google.name.as_deref(), Some("Ana"));

        let microsoft =
            identity_from_id_token(&jwt(r#"{"preferred_username":"bob@contoso.com","name":""}"#))
                .unwrap();
        assert_eq!(microsoft.email, "bob@contoso.com");
        assert!(microsoft.name.is_none());

        assert!(identity_from_id_token(&jwt(r#"{"name":"No email"}"#)).is_none());
        assert!(identity_from_id_token("garbage").is_none());
    }

    #[test]
    fn freshness_uses_a_margin() {
        let token = |expires_at| TokenSet {
            access_token: String::new(),
            refresh_token: String::new(),
            expires_at,
        };
        assert!(token(now_ms() + 10 * 60 * 1000).is_fresh());
        assert!(!token(now_ms() + 30 * 1000).is_fresh());
    }
}
