import type { AccountProvider, AuthType, ConnectionSecurity, IncomingProtocol } from "@models";

export interface ServerPreset {
  host: string;
  port: number;
  security: ConnectionSecurity;
}

export interface ProviderPreset {
  id: AccountProvider;
  authType: AuthType;
  incomingProtocol: IncomingProtocol;
  incoming: ServerPreset;
  smtp: ServerPreset;
}

/** Known connection settings per provider. Generic IMAP/POP3 start blank. */
export const providerPresets: Record<AccountProvider, ProviderPreset> = {
  google: {
    id: "google",
    authType: "oauth2",
    incomingProtocol: "imap",
    incoming: { host: "imap.gmail.com", port: 993, security: "ssl" },
    smtp: { host: "smtp.gmail.com", port: 465, security: "ssl" },
  },
  microsoft: {
    id: "microsoft",
    authType: "oauth2",
    incomingProtocol: "imap",
    incoming: { host: "outlook.office365.com", port: 993, security: "ssl" },
    smtp: { host: "smtp.office365.com", port: 587, security: "starttls" },
  },
  imap: {
    id: "imap",
    authType: "password",
    incomingProtocol: "imap",
    incoming: { host: "", port: 993, security: "ssl" },
    smtp: { host: "", port: 465, security: "ssl" },
  },
  pop3: {
    id: "pop3",
    authType: "password",
    incomingProtocol: "pop3",
    incoming: { host: "", port: 995, security: "ssl" },
    smtp: { host: "", port: 465, security: "ssl" },
  },
};
