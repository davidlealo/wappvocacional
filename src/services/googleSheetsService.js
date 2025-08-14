// src/services/googleSheetsService.js
import path from 'path';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const sheets = google.sheets('v4');

function getAuth() {
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function addRowToSheet(auth, spreadsheetId, range, values) {
  const request = {
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
    auth,
  };
  return sheets.spreadsheets.values.append(request);
}

/**
 * Agrega una fila a la hoja de LOG definida en .env
 */
async function appendToSheet(data) {
  try {
    const auth = getAuth();
    const authClient = await auth.getClient();
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
    const tabName = process.env.SHEETS_TAB_NAME || 'chats';

    await addRowToSheet(authClient, spreadsheetId, tabName, data);
    return 'Datos correctamente agregados';
  } catch (error) {
    console.error('[GoogleSheets] Error append:', error?.message || error);
    throw error;
  }
}

/**
 * Lee un rango A1 de un spreadsheet
 * @param {string} spreadsheetId
 * @param {string} rangeA1  (p.ej. 'Preguntas!A1:C1000')
 * @returns {Promise<string[][]>} valores
 */
export async function readSheetRange(spreadsheetId, rangeA1) {
  try {
    const auth = getAuth();
    const authClient = await auth.getClient();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeA1,
      auth: authClient,
    });
    return res.data.values || [];
  } catch (error) {
    console.error('[GoogleSheets] Error read:', error?.message || error);
    return [];
  }
}

export default appendToSheet;
