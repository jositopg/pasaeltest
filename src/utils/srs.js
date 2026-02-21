/**
 * SISTEMA DE REPETICIÓN ESPACIADA (SRS)
 * Basado en FSRS (Free Spaced Repetition Scheduler)
 * 
 * Cada pregunta tiene:
 * - stability: días hasta próximo repaso (empieza en 1)
 * - difficulty: dificultad 1-10 (empieza en 5)
 * - nextReview: fecha ISO del próximo repaso
 * - lastReview: fecha ISO del último repaso
 * - attempts: total de intentos
 * - errors: total de errores
 */

/**
 * Calcular próxima fecha de repaso después de responder
 */
export const calculateNextReview = (question, wasCorrect) => {
  const now = new Date();
  const stability = question.stability || 1;
  const difficulty = question.difficulty || 5;
  const attempts = (question.attempts || 0) + 1;
  const errors = (question.errors || 0) + (wasCorrect ? 0 : 1);

  let newStability, newDifficulty;

  if (wasCorrect) {
    // Acierto: aumentar estabilidad, reducir dificultad
    newStability = Math.min(stability * (2.5 - 0.15 * difficulty), 365);
    newDifficulty = Math.max(1, difficulty - 0.3);
  } else {
    // Fallo: resetear estabilidad, aumentar dificultad
    newStability = Math.max(0.5, stability * 0.3);
    newDifficulty = Math.min(10, difficulty + 0.5);
  }

  // Calcular fecha del próximo repaso
  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + Math.ceil(newStability));

  return {
    ...question,
    stability: Math.round(newStability * 100) / 100,
    difficulty: Math.round(newDifficulty * 100) / 100,
    nextReview: nextReviewDate.toISOString(),
    lastReview: now.toISOString(),
    attempts,
    errors,
  };
};

/**
 * Obtener preguntas que necesitan repaso hoy
 */
export const getDueQuestions = (themes) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = [];

  themes.forEach(theme => {
    if (!theme.questions) return;
    
    theme.questions.forEach(q => {
      // Si nunca se ha respondido, no entra en SRS todavía
      if (!q.attempts || q.attempts === 0) return;
      
      // Si no tiene nextReview, considerarla como pendiente
      if (!q.nextReview) {
        due.push({ ...q, themeNumber: theme.number, themeName: theme.name });
        return;
      }

      const reviewDate = new Date(q.nextReview);
      const reviewDay = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
      
      if (reviewDay <= today) {
        due.push({ ...q, themeNumber: theme.number, themeName: theme.name });
      }
    });
  });

  // Ordenar por dificultad descendente (las más difíciles primero)
  due.sort((a, b) => (b.difficulty || 5) - (a.difficulty || 5));

  return due;
};

/**
 * Obtener estadísticas del SRS
 */
export const getSRSStats = (themes) => {
  const due = getDueQuestions(themes);
  let totalWithSRS = 0;
  let totalMastered = 0; // stability > 30 días
  let totalLearning = 0; // stability 1-30 días
  let totalNew = 0; // sin intentos

  themes.forEach(theme => {
    if (!theme.questions) return;
    theme.questions.forEach(q => {
      if (!q.attempts || q.attempts === 0) {
        totalNew++;
      } else if ((q.stability || 1) > 30) {
        totalMastered++;
      } else {
        totalLearning++;
      }
      totalWithSRS++;
    });
  });

  return {
    dueToday: due.length,
    totalQuestions: totalWithSRS,
    mastered: totalMastered,
    learning: totalLearning,
    newQuestions: totalNew,
    dueQuestions: due,
  };
};

/**
 * Formatear días hasta próximo repaso
 */
export const formatNextReview = (nextReview) => {
  if (!nextReview) return 'Sin programar';
  
  const now = new Date();
  const review = new Date(nextReview);
  const diffMs = review - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays < 7) return `En ${diffDays} días`;
  if (diffDays < 30) return `En ${Math.ceil(diffDays / 7)} semanas`;
  return `En ${Math.ceil(diffDays / 30)} meses`;
};

/**
 * Obtener color de dificultad
 */
export const getDifficultyColor = (difficulty) => {
  if (!difficulty) return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Sin datos' };
  if (difficulty <= 3) return { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Fácil' };
  if (difficulty <= 6) return { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'Media' };
  if (difficulty <= 8) return { bg: 'bg-orange-500/20', text: 'text-orange-500', label: 'Difícil' };
  return { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Muy difícil' };
};
