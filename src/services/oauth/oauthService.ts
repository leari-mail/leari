import { invoke } from "@tauri-apps/api/core";

export type OAuthProvider = "google" | "microsoft";

export interface SignInResult {
  /** Opaque reference to the tokens, which stay in the Rust side. */
  handle: string;
  email: string;
  name: string | null;
}

/** OAuth sign-in (Google, Microsoft), run by the Rust side (src-tauri/src/oauth). */
export const oauthService = {
  /** Providers this build has client ids for. */
  providers: () => invoke<OAuthProvider[]>("oauth_providers"),

  /** Opens the provider's sign-in page in the browser; resolves once the user is back. */
  signIn: (provider: OAuthProvider, language: string) =>
    invoke<SignInResult>("oauth_sign_in", { provider, language }),

  cancel: () => invoke<void>("oauth_cancel"),

  /** Stores the signed-in tokens for an account (in the OS keychain). */
  attach: (accountId: string, handle: string) =>
    invoke<void>("oauth_attach", { accountId, handle }),
};
