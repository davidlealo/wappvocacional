// src/services/knowledgeService.js
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { readSheetRange } from './googleSheetsService.js';

dotenv.config();

let cache = { rows: [], ts: 0 };
const TTL_MS = 10 * 60 * 1000; // 10 minutos

function norm(s) {
  return (s || '').toString().toLowerCase();
}

/**
 * Convierte filas crudas a objetos {question, answer, category}
 */
function rowsToQA(rows) {
  if (!rows || rows.length === 0) return [];
  const [h0 = '', h1 = ''] = rows[0] || [];
  const looksHeader = norm(h0).includes('pregun') || norm(h1).includes('respu');
  const dataRows = looksHeader ? rows.slice(1) : rows;

  return dataRows
    .map((r) => ({
      question: (r[0] ?? '').toString().trim(),
      answer: (r[1] ?? '').toString().trim(),
      category: (r[2] ?? '').toString().trim(),
    }))
    .filter((x) => x.question && x.answer);
}

/**
 * Lee desde Excel local
 */
function readFromExcel() {
  const excelPath = process.env.KNOWLEDGE_EXCEL_PATH || 'src/data/Preguntas IA.xlsx';
  const full = path.isAbsolute(excelPath) ? excelPath : path.join(process.cwd(), excelPath);
  if (!fs.existsSync(full)) {
    console.warn('[Knowledge] Excel no encontrado:', full);
    return [];
  }
  const wb = XLSX.readFile(full);
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  return rowsToQA(rows);
}

/**
 * Lee desde Google Sheets
 */
async function readFromGoogle() {
  const ssId = process.env.SHEETS_KNOWLEDGE_SPREADSHEET_ID;
  const tab = process.env.SHEETS_KNOWLEDGE_TAB || 'Preguntas';
  if (!ssId) {
    console.warn('[Knowledge] SHEETS_KNOWLEDGE_SPREADSHEET_ID no definido');
    return [];
  }
  const rows = await readSheetRange(ssId, `${tab}!A1:C10000`);
  return rowsToQA(rows);
}

/**
 * Obtiene el corpus (cacheado 10 min)
 * Export: named
 */
export async function getKnowledge() {
  const now = Date.now();
  if (now - cache.ts < TTL_MS && cache.rows.length > 0) {
    return cache.rows;
  }

  const source = (process.env.KNOWLEDGE_SOURCE || 'excel').toLowerCase();
  let rows = [];
  if (source === 'google') rows = await readFromGoogle();
  else rows = readFromExcel();

  cache = { rows, ts: now };
  return rows;
}

/**
 * Recupera K entradas más relevantes
 * Export: named
 */
export async function retrieveRelevant(userQuery, k = 6) {
  const corpus = await getKnowledge();
  const uq = norm(userQuery);
  const uqTokens = new Set(uq.split(/\W+/).filter(Boolean));

  const scored = corpus.map((item) => {
    const text = norm(item.question + ' ' + item.answer + ' ' + item.category);
    const tokens = new Set(text.split(/\W+/).filter(Boolean));
    let overlap = 0;
    uqTokens.forEach((t) => { if (tokens.has(t)) overlap += 1; });
    return { item, score: overlap };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.item);
}

/**
 * Export default: objeto con helpers (opcional)
 */
const KnowledgeAPI = { getKnowledge, retrieveRelevant };
export default KnowledgeAPI;
