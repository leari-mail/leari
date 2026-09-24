import type {
  accountProviders,
  accounts,
  authTypes,
  connectionSecurities,
  incomingProtocols,
} from "@db/schema";

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type AccountProvider = (typeof accountProviders)[number];
export type AuthType = (typeof authTypes)[number];
export type ConnectionSecurity = (typeof connectionSecurities)[number];
export type IncomingProtocol = (typeof incomingProtocols)[number];
