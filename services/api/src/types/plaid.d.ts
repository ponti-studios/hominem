declare module 'plaid' {
  export class Configuration {
    constructor(config: unknown);
  }

  export class PlaidApi {
    constructor(configuration: Configuration);
    linkTokenCreate(
      input: unknown,
    ): Promise<{ data: { link_token: string; expiration: string; request_id: string } }>;
    itemPublicTokenExchange(
      input: unknown,
    ): Promise<{ data: { accessToken: string; providerItemId: string; request_id: string } }>;
    itemAccessTokenInvalidate(input: unknown): Promise<unknown>;
    itemRemove(input: unknown): Promise<unknown>;
  }

  export const PlaidEnvironments: Record<string, { basePath?: string }>;
  export enum Products {
    Transactions = 'transactions',
  }
  export enum CountryCode {
    Us = 'US',
  }
}
