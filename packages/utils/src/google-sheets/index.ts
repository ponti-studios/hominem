import {readFile} from 'node:fs';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import * as dotenv from 'dotenv';
import {google, type sheets_v4} from 'googleapis';
import {JWT, type OAuth2Client} from 'google-auth-library';

import type {SpreadSheetRange} from './google-sheets-types';
import logger from '../logger';

dotenv.config({
  path: resolve(__dirname, `../.env.${process.env.NODE_ENV}`),
});

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const promisedFile = promisify(readFile);

export async function auth(): Promise<OAuth2Client> {
  const credentials = JSON.parse(
    await promisedFile(resolve(__dirname, '../credentials.json'), 'utf-8')
  );

  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });

  try {
    await client.authorize();
  } catch (error) {
    logger.error({
      label: 'Google Auth',
      message: `Google client could not be authorized: ${error}`,
    });
    process.exit(1);
  }

  return client;
}

export async function getClient(): Promise<sheets_v4.Sheets> {
  return google.sheets({version: 'v4', auth: (await auth()) as any});
}

export async function getSheet(spreadsheetId: string): Promise<{}> {
  const client = await getClient();

  return (await client.spreadsheets.get({spreadsheetId})).data;
}

/**
 * Returns
 * @param {string} spreadsheetId ID of Google Sheet to retrieve values from
 */
export async function getSheets(
  spreadsheetId: string
): Promise<(string | null | undefined)[] | undefined> {
  const client = await getClient();
  try {
    const {data} = await client.spreadsheets.get({spreadsheetId});
    return data.sheets?.map(
      (sheet: sheets_v4.Schema$Sheet) => sheet.properties?.title
    );
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}

/**
 * Get range of values from spreadsheet
 * @param {string} spreadsheetId ID of Google Sheet
 * @param {SpreadSheetRange} sheet Range of spreadsheet to capture
 */
export async function getSheetValues(
  spreadsheetId: string,
  sheet: SpreadSheetRange
): Promise<any[]> {
  const sheets = await getClient();
  const {range} = sheet;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const [headers, ...rows]: string[][] = response.data.values;

  const values = rows.map((row: any[]) =>
    headers.reduce(
      (record, header, idx) => ({...record, [header]: row[idx]}),
      {}
    )
  );

  return values;
}
