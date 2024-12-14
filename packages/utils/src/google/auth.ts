import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { authenticate as googleAuthenticate } from "@google-cloud/local-auth";
import logger from "../logger";
import { google } from "googleapis";

type AuthClient =
  | Awaited<ReturnType<typeof googleAuthenticate>>
  | ReturnType<typeof google.auth.fromJSON>
  | null;

export const TOKEN_PATH = path.join(__dirname, "token.json");
export const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

type GoogleOAuthServiceOptions = {
  scopes: string[];
};
export class GoogleOAuthService {
  private client: AuthClient;
  private options: GoogleOAuthServiceOptions;

  static async getCredentials(): Promise<{ installed: any; web: any }> {
    try {
      const content = await readFile(CREDENTIALS_PATH);
      return JSON.parse(content.toString());
    } catch (err) {
      logger.error("Error loading client secret file:", err);
      throw err;
    }
  }

  constructor(options: GoogleOAuthServiceOptions) {
    this.client = null;
    this.options = options;
  }

  async getClient(): Promise<AuthClient> {
    if (!this.client) {
      this.client = await this.authorize(this.options);
    }
    return this.client;
  }

  // Load or request or authorization to call APIs
  async authorize(
    { scopes }: { scopes: string[] },
  ): Promise<AuthClient> {
    let client: AuthClient = await this.loadSavedCredentialsIfExist();

    if (!client) {
      client = await googleAuthenticate({
        scopes,
        keyfilePath: CREDENTIALS_PATH,
      });
    }

    if (client?.credentials) {
      await this.saveCredentials(client);
    }

    return client;
  }

  // Create token file if it doesn't exist
  async saveCredentials(client: AuthClient): Promise<void> {
    if (!client?.credentials) return;

    try {
      const keys = await GoogleOAuthService.getCredentials();
      const key = keys.installed || keys.web;
      const payload = JSON.stringify({
        type: "authorized_user",
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
      });
      await writeFile(TOKEN_PATH, payload);
    } catch (err) {
      logger.error("Error loading client secret file:", err);
      throw err;
    }
  }

  async loadSavedCredentialsIfExist(): Promise<
    ReturnType<typeof google.auth.fromJSON> | null
  > {
    try {
      const content = await readFile(TOKEN_PATH);
      const credentials = JSON.parse(content.toString());
      return google.auth.fromJSON(credentials);
    } catch (err) {
      logger.warn("No token file found. Requesting authorization...");
      return null;
    }
  }
}
