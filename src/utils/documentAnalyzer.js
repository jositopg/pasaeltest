/**
 * ANALIZADOR INTELIGENTE DE DOCUMENTOS
 * 
 * Analiza la estructura de documentos y determina:
 * - Secciones principales
 * - Nivel de importancia de cada sección
 * - Tipo de contenido (normativa, conceptos, ejemplos)
 * - Recomendaciones de número de preguntas
 */

/**
 * Detectar tipo de sección basado en el contenido
 */
const detectSectionType = (text) => {
  const lowerText = text.toLowerCase();
  
  // Patrones para identificar tipo de contenido
  const patterns = {
    legislation: /artículo|ley|decreto|real decreto|constitución|normativa|reglamento|ordenanza|disposición|capítulo|título|sección/i,
    concepts: /definición|concepto|qué es|se entiende por|características|elementos|principios/i,
    procedures: /procedimiento|trámite|pasos|requisitos|plazo|solicitud|instancia|recurso/i,
    data: /\d{1,2}\/\d{1,2}\/\d{2,4}|\d+%|\d+\s*(años|meses|días)|cifras|estadística|dato/i,
    examples: /ejemplo|caso práctico|supuesto|ilustración|por ejemplo|pongamos que/i,
    introduction: /introducción|presentación|prólogo|preámbulo|objeto|finalidad/i
  };
  
  const scores = {};
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    scores[type] = matches ? matches.length : 0;
  }
  
  // Determinar tipo dominante
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'general';
  
  const dominantType = Object.keys(scores).find(key => scores[key] === maxScore);
  return dominantType;
};

/**
 * Calcular importancia de una sección
 */
const calculateImportance = (section) => {
  let importance = 50; // Base
  
  // Factores que aumentan importancia
  if (section.type === 'legislation') importance += 30;
  if (section.type === 'concepts') importance += 25;
  if (section.type === 'procedures') importance += 20;
  if (section.type === 'data') importance += 15;
  
  // Factores que disminuyen importancia
  if (section.type === 'introduction') importance -= 20;
  if (section.type === 'examples') importance -= 10;
  
  // Longitud de la sección
  if (section.length > 5000) importance += 10;
  if (section.length < 1000) importance -= 10;
  
  // Densidad de información (palabras clave)
  const keywordDensity = (section.keywordMatches || 0) / (section.length / 100);
  if (keywordDensity > 5) importance += 15;
  
  // Normalizar entre 0-100
  return Math.max(0, Math.min(100, importance));
};

/**
 * Determinar nivel de importancia
 */
const getImportanceLevel = (score) => {
  if (score >= 75) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

/**
 * Detectar secciones en el documento
 */
export const analyzeSections = (text) => {
  const sections = [];
  
  // Patrones para detectar encabezados
  const headerPatterns = [
    /^#{1,3}\s+(.+)$/gm,                    // Markdown headers
    /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,50})$/gm, // MAYÚSCULAS
    /^(Capítulo|Título|Sección|Artículo)\s+([IVXLCDM]+|\d+)/gim,
    /^(\d+\.)\s+(.+)$/gm                    // Numeración 1. 2. 3.
  ];
  
  let currentSection = {
    title: 'Inicio del documento',
    content: '',
    start: 0,
    type: 'general'
  };
  
  const lines = text.split('\n');
  let currentPosition = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detectar si es un encabezado
    let isHeader = false;
    let headerTitle = null;
    
    for (const pattern of headerPatterns) {
      const match = line.match(pattern);
      if (match && line.length < 100 && line.length > 5) {
        isHeader = true;
        headerTitle = line;
        break;
      }
    }
    
    if (isHeader && currentSection.content.length > 100) {
      // Guardar sección anterior
      currentSection.end = currentPosition;
      currentSection.length = currentSection.content.length;
      currentSection.type = detectSectionType(currentSection.content);
      
      // Calcular palabras clave
      const keywords = currentSection.content.match(/artículo|ley|decreto|plazo|requisito|definición|concepto/gi);
      currentSection.keywordMatches = keywords ? keywords.length : 0;
      
      currentSection.importance = calculateImportance(currentSection);
      currentSection.level = getImportanceLevel(currentSection.importance);
      
      sections.push(currentSection);
      
      // Iniciar nueva sección
      currentSection = {
        title: headerTitle,
        content: '',
        start: currentPosition,
        type: 'general'
      };
    } else {
      currentSection.content += line + '\n';
    }
    
    currentPosition += line.length + 1;
  }
  
  // Guardar última sección
  if (currentSection.content.length > 100) {
    currentSection.end = currentPosition;
    currentSection.length = currentSection.content.length;
    currentSection.type = detectSectionType(currentSection.content);
    
    const keywords = currentSection.content.match(/artículo|ley|decreto|plazo|requisito|definición|concepto/gi);
    currentSection.keywordMatches = keywords ? keywords.length : 0;
    
    currentSection.importance = calculateImportance(currentSection);
    currentSection.level = getImportanceLevel(currentSection.importance);
    
    sections.push(currentSection);
  }
  
  return sections;
};

/**
 * Calcular número de preguntas recomendadas por sección
 */
export const calculateQuestionDistribution = (sections, totalQuestions = 200) => {
  // Calcular puntuación total
  const totalImportance = sections.reduce((sum, s) => sum + s.importance, 0);
  
  // Distribuir preguntas proporcionalmente
  const distribution = sections.map(section => {
    const proportion = section.importance / totalImportance;
    let questions = Math.round(totalQuestions * proportion);
    
    // Mínimos y máximos por nivel
    if (section.level === 'critical') {
      questions = Math.max(questions, 40);
    } else if (section.level === 'high') {
      questions = Math.max(questions, 25);
    } else if (section.level === 'medium') {
      questions = Math.max(questions, 15);
    } else {
      questions = Math.max(questions, 10);
    }
    
    // Máximo por sección
    questions = Math.min(questions, 50);
    
    return {
      ...section,
      recommendedQuestions: questions
    };
  });
  
  // Ajustar si nos pasamos del total
  const currentTotal = distribution.reduce((sum, s) => sum + s.recommendedQuestions, 0);
  if (currentTotal > totalQuestions) {
    const factor = totalQuestions / currentTotal;
    distribution.forEach(s => {
      s.recommendedQuestions = Math.max(10, Math.floor(s.recommendedQuestions * factor));
    });
  }
  
  return distribution;
};

/**
 * Generar reporte de análisis
 */
export const generateAnalysisReport = (sections) => {
  const critical = sections.filter(s => s.level === 'critical');
  const high = sections.filter(s => s.level === 'high');
  const medium = sections.filter(s => s.level === 'medium');
  const low = sections.filter(s => s.level === 'low');
  
  const totalQuestions = sections.reduce((sum, s) => sum + s.recommendedQuestions, 0);
  
  const report = {
    totalSections: sections.length,
    breakdown: {
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      low: low.length
    },
    totalQuestions,
    estimatedTime: Math.ceil(sections.length * 10 / 60), // minutos
    sections: sections.map(s => ({
      title: s.title.substring(0, 60),
      type: s.type,
      level: s.level,
      importance: s.importance,
      questions: s.recommendedQuestions,
      length: s.length
    }))
  };
  
  return report;
};

/**
 * Función principal de análisis
 */
export const analyzeDocument = (text) => {
  console.log('📊 Analizando estructura del documento...');
  
  const sections = analyzeSections(text);
  console.log(`✅ ${sections.length} secciones detectadas`);
  
  const withDistribution = calculateQuestionDistribution(sections);
  console.log('✅ Distribución de preguntas calculada');
  
  const report = generateAnalysisReport(withDistribution);
  console.log('✅ Reporte generado');
  
  return {
    sections: withDistribution,
    report
  };
};

/**
 * Determinar tipos de preguntas por sección
 */
export const determineQuestionTypes = (section) => {
  const types = [];
  
  if (section.type === 'legislation') {
    types.push(
      { type: 'article', percentage: 40, difficulty: 'media' },
      { type: 'application', percentage: 30, difficulty: 'difícil' },
      { type: 'definition', percentage: 30, difficulty: 'fácil' }
    );
  } else if (section.type === 'concepts') {
    types.push(
      { type: 'definition', percentage: 50, difficulty: 'fácil' },
      { type: 'differentiation', percentage: 30, difficulty: 'media' },
      { type: 'application', percentage: 20, difficulty: 'media' }
    );
  } else if (section.type === 'procedures') {
    types.push(
      { type: 'sequence', percentage: 40, difficulty: 'media' },
      { type: 'requirements', percentage: 30, difficulty: 'media' },
      { type: 'exceptions', percentage: 30, difficulty: 'difícil' }
    );
  } else if (section.type === 'data') {
    types.push(
      { type: 'numeric', percentage: 50, difficulty: 'fácil' },
      { type: 'dates', percentage: 30, difficulty: 'fácil' },
      { type: 'comparison', percentage: 20, difficulty: 'media' }
    );
  } else {
    types.push(
      { type: 'definition', percentage: 40, difficulty: 'fácil' },
      { type: 'application', percentage: 40, difficulty: 'media' },
      { type: 'complex', percentage: 20, difficulty: 'difícil' }
    );
  }
  
  return types;
};
