/**
 * Exportar/importar datos de PasaElTest en formato JSON
 */

export function exportData(themes, testName = 'Mi Test') {
  const themesWithContent = themes.filter(t => t.questions?.length > 0 || t.name !== `Tema ${t.number}`);

  const exportObj = {
    version: '1.1',
    exportedAt: new Date().toISOString(),
    app: 'PasaElTest',
    test: { name: testName },
    themes: themesWithContent.map(t => ({
      number: t.number,
      name: t.name,
      questions: (t.questions || []).map(q => ({
        text: q.text,
        options: q.options,
        correct: q.correct,
        difficulty: q.difficulty || 'media',
        explanation: q.explanation || '',
      })),
    })),
    stats: {
      totalThemes: themesWithContent.length,
      totalQuestions: themesWithContent.reduce((s, t) => s + (t.questions?.length || 0), 0),
    },
  };

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pasaeltest-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return exportObj.stats;
}

export function importData(jsonData, currentThemes, onUpdateTheme) {
  if (!jsonData?.themes || !Array.isArray(jsonData.themes)) {
    throw new Error('Formato de archivo no válido. Debe ser un backup de PasaElTest.');
  }

  let importedQuestions = 0;
  let importedThemes = 0;

  for (const importedTheme of jsonData.themes) {
    const currentTheme = currentThemes.find(t => t.number === importedTheme.number);
    if (!currentTheme) continue;

    // Actualizar nombre si no es el genérico
    const newName = importedTheme.name && importedTheme.name !== `Tema ${importedTheme.number}`
      ? importedTheme.name
      : currentTheme.name;

    // Evitar duplicados por texto de pregunta
    const existingTexts = new Set((currentTheme.questions || []).map(q => q.text?.trim().toLowerCase()));
    const newQuestions = (importedTheme.questions || [])
      .filter(q => q.text && !existingTexts.has(q.text.trim().toLowerCase()))
      .map(q => ({
        id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: q.text,
        options: q.options || [],
        correct: q.correct ?? 0,
        difficulty: q.difficulty || 'media',
        explanation: q.explanation || '',
        stability: 1,
        srs_difficulty: 5,
        next_review: null,
        last_review: null,
        attempts: 0,
        errors_count: 0,
      }));

    if (newQuestions.length > 0 || newName !== currentTheme.name) {
      onUpdateTheme({
        ...currentTheme,
        name: newName,
        questions: [...(currentTheme.questions || []), ...newQuestions],
      });
      importedQuestions += newQuestions.length;
      importedThemes++;
    }
  }

  return { importedThemes, importedQuestions };
}
