/**
 * IMPORTADOR DE PREGUNTAS DESDE PDF/EXCEL
 * 
 * Formatos soportados:
 * - PDF con estructura específica
 * - Excel (.xlsx) con columnas definidas
 * 
 * Estructura esperada en Excel:
 * | Pregunta | Opción A | Opción B | Opción C | Correcta | Dificultad |
 * |----------|----------|----------|----------|----------|------------|
 * | ¿Qué...? | Opción 1 | Opción 2 | Opción 3 | 0        | media      |
 * 
 * Estructura esperada en PDF:
 * PREGUNTA: ¿Qué es...?
 * A) Opción 1
 * B) Opción 2
 * C) Opción 3
 * CORRECTA: A
 * DIFICULTAD: media
 * ---
 */

import * as XLSX from 'xlsx';

/**
 * Parsear preguntas desde Excel
 */
export const parseExcelQuestions = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Leer primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet);
        
        // Validar y transformar datos
        const questions = rawData.map((row, index) => {
          // Validar campos requeridos
          if (!row.Pregunta) {
            throw new Error(`Fila ${index + 2}: Falta campo "Pregunta"`);
          }
          
          if (!row['Opción A'] || !row['Opción B'] || !row['Opción C']) {
            throw new Error(`Fila ${index + 2}: Faltan opciones (A, B, C)`);
          }
          
          if (row.Correcta === undefined || row.Correcta === null) {
            throw new Error(`Fila ${index + 2}: Falta campo "Correcta"`);
          }
          
          // Normalizar índice de respuesta correcta
          let correctIndex;
          if (typeof row.Correcta === 'string') {
            const upper = row.Correcta.toUpperCase();
            if (upper === 'A' || upper === '0') correctIndex = 0;
            else if (upper === 'B' || upper === '1') correctIndex = 1;
            else if (upper === 'C' || upper === '2') correctIndex = 2;
            else throw new Error(`Fila ${index + 2}: Valor de "Correcta" inválido (debe ser A, B, C o 0, 1, 2)`);
          } else if (typeof row.Correcta === 'number') {
            correctIndex = row.Correcta;
            if (correctIndex < 0 || correctIndex > 2) {
              throw new Error(`Fila ${index + 2}: Valor de "Correcta" fuera de rango (0-2)`);
            }
          } else {
            throw new Error(`Fila ${index + 2}: Tipo de "Correcta" inválido`);
          }
          
          // Normalizar dificultad
          const dificultad = (row.Dificultad || 'media').toLowerCase();
          if (!['fácil', 'facil', 'media', 'difícil', 'dificil'].includes(dificultad)) {
            console.warn(`Fila ${index + 2}: Dificultad "${dificultad}" no reconocida, usando "media"`);
          }
          
          return {
            text: row.Pregunta.trim(),
            options: [
              row['Opción A'].trim(),
              row['Opción B'].trim(),
              row['Opción C'].trim()
            ],
            correct: correctIndex,
            difficulty: dificultad === 'fácil' || dificultad === 'facil' ? 'fácil' :
                       dificultad === 'difícil' || dificultad === 'dificil' ? 'difícil' : 'media',
            id: `imported_${Date.now()}_${index}`,
            stats: {
              timesAnswered: 0,
              timesCorrect: 0,
              averageTime: 0
            }
          };
        });
        
        resolve(questions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo Excel'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parsear preguntas desde PDF
 */
export const parsePDFQuestions = async (text) => {
  const questions = [];
  
  // Dividir por separador de preguntas
  const blocks = text.split(/\n---+\n/).filter(b => b.trim());
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    
    try {
      // Extraer pregunta
      const preguntaMatch = block.match(/PREGUNTA:\s*(.+?)(?:\n|$)/i);
      if (!preguntaMatch) {
        console.warn(`Bloque ${i + 1}: No se encontró PREGUNTA`);
        continue;
      }
      const pregunta = preguntaMatch[1].trim();
      
      // Extraer opciones
      const opcionA = block.match(/A\)\s*(.+?)(?:\n|$)/i);
      const opcionB = block.match(/B\)\s*(.+?)(?:\n|$)/i);
      const opcionC = block.match(/C\)\s*(.+?)(?:\n|$)/i);
      
      if (!opcionA || !opcionB || !opcionC) {
        console.warn(`Bloque ${i + 1}: Faltan opciones (A, B, C)`);
        continue;
      }
      
      // Extraer respuesta correcta
      const correctaMatch = block.match(/CORRECTA:\s*([ABC0-2])/i);
      if (!correctaMatch) {
        console.warn(`Bloque ${i + 1}: No se encontró CORRECTA`);
        continue;
      }
      
      const correctaStr = correctaMatch[1].toUpperCase();
      let correctIndex;
      if (correctaStr === 'A' || correctaStr === '0') correctIndex = 0;
      else if (correctaStr === 'B' || correctaStr === '1') correctIndex = 1;
      else if (correctaStr === 'C' || correctaStr === '2') correctIndex = 2;
      else {
        console.warn(`Bloque ${i + 1}: Valor de CORRECTA inválido`);
        continue;
      }
      
      // Extraer dificultad (opcional)
      const dificultadMatch = block.match(/DIFICULTAD:\s*(\w+)/i);
      let dificultad = 'media';
      if (dificultadMatch) {
        const diff = dificultadMatch[1].toLowerCase();
        if (['fácil', 'facil'].includes(diff)) dificultad = 'fácil';
        else if (['difícil', 'dificil'].includes(diff)) dificultad = 'difícil';
      }
      
      questions.push({
        text: pregunta,
        options: [
          opcionA[1].trim(),
          opcionB[1].trim(),
          opcionC[1].trim()
        ],
        correct: correctIndex,
        difficulty: dificultad,
        id: `imported_${Date.now()}_${i}`,
        stats: {
          timesAnswered: 0,
          timesCorrect: 0,
          averageTime: 0
        }
      });
    } catch (error) {
      console.error(`Error procesando bloque ${i + 1}:`, error);
    }
  }
  
  return questions;
};

/**
 * Extraer texto de PDF usando PDF.js
 */
export const extractPDFText = async (file) => {
  // Esta función requiere pdf.js
  // Por simplicidad, aquí asumimos que el usuario copia/pega el texto
  // o usamos una librería de extracción
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        // Aquí iría la lógica de pdf.js
        // Por ahora, devolvemos el texto crudo
        const text = e.target.result;
        resolve(text);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo PDF'));
    reader.readAsText(file);
  });
};

/**
 * Validar formato de pregunta
 */
export const validateQuestion = (question) => {
  const errors = [];
  
  if (!question.text || question.text.trim().length < 10) {
    errors.push('La pregunta debe tener al menos 10 caracteres');
  }
  
  if (!question.options || question.options.length !== 3) {
    errors.push('Deben haber exactamente 3 opciones');
  }
  
  if (question.options) {
    question.options.forEach((opt, i) => {
      if (!opt || opt.trim().length < 2) {
        errors.push(`Opción ${String.fromCharCode(65 + i)} demasiado corta`);
      }
    });
  }
  
  if (question.correct === undefined || question.correct < 0 || question.correct > 2) {
    errors.push('Respuesta correcta debe ser 0, 1 o 2');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Generar plantilla de Excel
 */
export const generateExcelTemplate = () => {
  const template = [
    {
      'Pregunta': '¿Cuál es la capital de España?',
      'Opción A': 'Madrid',
      'Opción B': 'Barcelona',
      'Opción C': 'Valencia',
      'Correcta': 0,
      'Dificultad': 'fácil'
    },
    {
      'Pregunta': 'Según el artículo 14 de la Constitución, ¿qué principio se establece?',
      'Opción A': 'Igualdad ante la ley',
      'Opción B': 'Libertad de expresión',
      'Opción C': 'Derecho a la educación',
      'Correcta': 0,
      'Dificultad': 'media'
    },
    {
      'Pregunta': '¿En qué año se aprobó la Constitución Española?',
      'Opción A': '1976',
      'Opción B': '1978',
      'Opción C': '1980',
      'Correcta': 1,
      'Dificultad': 'media'
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Preguntas');
  
  return workbook;
};

/**
 * Descargar plantilla Excel
 */
export const downloadExcelTemplate = () => {
  const workbook = generateExcelTemplate();
  XLSX.writeFile(workbook, 'plantilla_preguntas.xlsx');
};

/**
 * Generar plantilla de PDF (como texto)
 */
export const generatePDFTemplate = () => {
  return `PREGUNTA: ¿Cuál es la capital de España?
A) Madrid
B) Barcelona
C) Valencia
CORRECTA: A
DIFICULTAD: fácil
---
PREGUNTA: Según el artículo 14 de la Constitución, ¿qué principio se establece?
A) Igualdad ante la ley
B) Libertad de expresión
C) Derecho a la educación
CORRECTA: A
DIFICULTAD: media
---
PREGUNTA: ¿En qué año se aprobó la Constitución Española?
A) 1976
B) 1978
C) 1980
CORRECTA: B
DIFICULTAD: media
---`;
};
