import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta a tu archivo Excel
const workbook = XLSX.readFile(path.join(__dirname, '../Preguntas IA.xlsx'));
const sheetName = workbook.SheetNames[0]; // primera hoja
const sheet = workbook.Sheets[sheetName];

// Convertir a JSON
const data = XLSX.utils.sheet_to_json(sheet); 

// data será un arreglo de objetos { Pregunta: '...', Respuesta: '...' }

export const searchAnswer = (userQuestion) => {
  // Aquí puedes usar una búsqueda simple por coincidencia de palabra clave
  const lowerQuestion = userQuestion.toLowerCase();

  const match = data.find(row => row.Pregunta.toLowerCase().includes(lowerQuestion));

  if (match) return match.Respuesta;

  return null;
};
