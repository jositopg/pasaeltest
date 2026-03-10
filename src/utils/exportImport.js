/**
 * Exportar/importar preguntas de PasaElTest en formato Excel (.xlsx)
 * Mucho más accesible que JSON — cualquier usuario puede abrir y editar el archivo.
 *
 * Columnas: Tema Nº | Nombre Tema | Pregunta | Opción A | Opción B | Opción C | Opción D | Correcta | Dificultad | Explicación
 * "Correcta" es una letra (A/B/C/D) — fácil de entender
 */

import * as XLSX from 'xlsx';
import { normalizeDifficulty } from './constants';

const COLUMNS = ['Tema Nº', 'Nombre Tema', 'Pregunta', 'Opción A', 'Opción B', 'Opción C', 'Opción D', 'Correcta', 'Dificultad', 'Explicación'];
const LETTER = ['A', 'B', 'C', 'D'];

export function exportData(themes, testName = 'Mi Test') {
  const rows = [];
  let totalQuestions = 0;
  let totalThemes = 0;

  for (const theme of themes) {
    if (!theme.questions?.length) continue;
    totalThemes++;
    for (const q of theme.questions) {
      const options = q.options || [];
      rows.push({
        'Tema Nº': theme.number,
        'Nombre Tema': theme.name,
        'Pregunta': q.text || '',
        'Opción A': options[0] || '',
        'Opción B': options[1] || '',
        'Opción C': options[2] || '',
        'Opción D': options[3] || '',
        'Correcta': LETTER[q.correct] || 'A',
        'Dificultad': q.difficulty || 'media',
        'Explicación': q.explanation || '',
      });
      totalQuestions++;
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });

  // Ancho de columnas para legibilidad
  ws['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 50 }, { wch: 30 }, { wch: 30 },
    { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Preguntas');

  const filename = `${testName.replace(/[^a-z0-9]/gi, '_')}_preguntas_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);

  return { totalThemes, totalQuestions };
}

export function importData(file, currentThemes, onUpdateTheme) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) throw new Error('El archivo está vacío.');

        // Detectar si tiene columna "Tema Nº" (nuestro formato) o es el formato antiguo de JSON
        const firstRow = rows[0];
        if (!('Pregunta' in firstRow)) {
          throw new Error('Formato no reconocido. Usa un archivo exportado desde PasaElTest.');
        }

        let importedQuestions = 0;
        let importedThemes = 0;

        // Agrupar filas por tema
        const byTheme = {};
        for (const row of rows) {
          const num = parseInt(row['Tema Nº']) || 0;
          if (!byTheme[num]) byTheme[num] = { name: row['Nombre Tema'] || `Tema ${num}`, questions: [] };

          const correctLetter = String(row['Correcta'] || 'A').toUpperCase().trim();
          const correctIndex = LETTER.indexOf(correctLetter) !== -1
            ? LETTER.indexOf(correctLetter)
            : (parseInt(correctLetter) || 0);

          const options = [row['Opción A'], row['Opción B'], row['Opción C'], row['Opción D']]
            .map(o => String(o || '').trim())
            .filter(Boolean);

          if (!row['Pregunta'] || options.length < 2) continue;

          byTheme[num].questions.push({
            text: String(row['Pregunta']).trim(),
            options,
            correct: correctIndex,
            difficulty: normalizeDifficulty(String(row['Dificultad'] || 'media')),
            explanation: String(row['Explicación'] || '').trim(),
          });
        }

        // Fusionar con temas existentes (sin duplicados)
        for (const [numStr, imported] of Object.entries(byTheme)) {
          const num = parseInt(numStr);
          const current = currentThemes.find(t => t.number === num);
          if (!current) continue;

          const existingTexts = new Set((current.questions || []).map(q => q.text?.trim().toLowerCase()));
          const newQs = imported.questions
            .filter(q => !existingTexts.has(q.text.toLowerCase()))
            .map(q => ({
              ...q,
              id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              stability: 1, srs_difficulty: 5, next_review: null,
              last_review: null, attempts: 0, errors_count: 0,
            }));

          const newName = imported.name && imported.name !== `Tema ${num}` ? imported.name : current.name;

          if (newQs.length > 0 || newName !== current.name) {
            onUpdateTheme({ ...current, name: newName, questions: [...(current.questions || []), ...newQs] });
            importedQuestions += newQs.length;
            importedThemes++;
          }
        }

        resolve({ importedThemes, importedQuestions });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}
