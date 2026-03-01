import { useState, useEffect } from 'react';
import { dbHelpers } from '../supabaseClient';
import { DEFAULT_PROFILE } from '../utils/constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRealId = (id) => id && UUID_REGEX.test(id);

/**
 * Hook para gestionar datos del usuario (temas, exámenes, perfil)
 */
const useUserData = (isAuthenticated, currentUser) => {
  const [themes, setThemes] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos cuando el usuario se autentica
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    if (currentUser.isGuest) {
      loadGuestData();
    } else {
      loadUserData();
    }
  }, [isAuthenticated, currentUser]);

  const createInitialThemes = (numThemes = 90) => {
    return Array.from({ length: numThemes }, (_, i) => ({
      number: i + 1,
      name: `Tema ${i + 1}`,
      documents: [],
      questions: []
    }));
  };

  const mapQuestionFromDB = (q) => ({
    id: q.id,
    text: q.text,
    options: q.options,
    correct: q.correct_answer,
    difficulty: q.difficulty,
    explanation: q.explanation || '',
    stability: q.stability ?? 1,
    srs_difficulty: q.srs_difficulty ?? 5,
    next_review: q.next_review || null,
    last_review: q.last_review || null,
    attempts: q.attempts ?? 0,
    errors_count: q.errors_count ?? 0,
  });

  const mapDocumentFromDB = (d) => ({
    id: d.id,
    type: d.type,
    content: d.content || '',
    fileName: d.file_name || '',
    processedContent: d.processed_content || '',
    searchResults: d.search_results || null,
  });

  const loadGuestData = () => {
    setLoading(true);
    setProfile({
      ...DEFAULT_PROFILE,
      name: currentUser.name,
      examName: currentUser.oposicion,
    });
    setThemes(createInitialThemes());
    setLoading(false);
  };

  const loadUserData = async () => {
    if (!currentUser || currentUser.isGuest) return;
    setLoading(true);

    try {
      // Profile
      setProfile({
        ...DEFAULT_PROFILE,
        name: currentUser.name,
        examName: currentUser.oposicion,
      });

      // Themes
      const { data: themesData, error: themesError } = await dbHelpers.getThemes(currentUser.id);

      if (themesError) {
        console.error('Error loading themes:', themesError);
        setThemes(createInitialThemes());
      } else if (themesData && themesData.length > 0) {
        setThemes(themesData.map(theme => ({
          id: theme.id,
          number: theme.number,
          name: theme.name,
          documents: (theme.documents || []).map(mapDocumentFromDB),
          questions: (theme.questions || []).map(mapQuestionFromDB),
        })));
      } else {
        // Create initial themes in Supabase with a single batch insert
        const initialThemes = createInitialThemes();
        const { data: created, error: createError } = await dbHelpers.createThemesBatch(currentUser.id, initialThemes);
        if (createError) {
          console.error('Error creating initial themes:', createError);
          setThemes(initialThemes);
        } else if (created) {
          setThemes(created.map(theme => ({
            id: theme.id,
            number: theme.number,
            name: theme.name,
            documents: [],
            questions: []
          })));
        }
      }

      // Exam history
      const { data: examsData } = await dbHelpers.getExamHistory(currentUser.id);
      if (examsData) {
        setExamHistory(examsData.map(exam => ({
          ...exam.config,
          score: exam.score,
          date: exam.created_at
        })));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setThemes(createInitialThemes());
    }

    setLoading(false);
  };

  const updateTheme = async (theme) => {
    if (!currentUser || currentUser.isGuest) {
      setThemes(prev => prev.map(t => t.number === theme.number ? theme : t));
      return;
    }

    if (!theme.id) {
      setThemes(prev => prev.map(t => t.number === theme.number ? theme : t));
      return;
    }

    try {
      // 1. Save theme name/number
      const { error: themeError } = await dbHelpers.updateTheme(theme.id, {
        name: theme.name,
        number: theme.number
      });
      if (themeError) {
        console.error('Error updating theme:', themeError);
        return;
      }

      // Get old theme for comparison
      const oldTheme = themes.find(t => t.number === theme.number) || {};
      const oldQuestions = oldTheme.questions || [];
      const newQuestions = theme.questions || [];
      const oldDocs = oldTheme.documents || [];
      const newDocs = theme.documents || [];

      // 2. Questions persistence
      const questionsToInsert = newQuestions.filter(q => !isRealId(q.id));
      const deletedQuestionIds = oldQuestions
        .filter(q => isRealId(q.id) && !newQuestions.find(nq => nq.id === q.id))
        .map(q => q.id);
      const srsUpdates = newQuestions.filter(q => {
        if (!isRealId(q.id)) return false;
        const old = oldQuestions.find(oq => oq.id === q.id);
        if (!old) return false;
        return (
          q.stability !== old.stability ||
          q.srs_difficulty !== old.srs_difficulty ||
          q.next_review !== old.next_review ||
          q.attempts !== old.attempts ||
          q.errors_count !== old.errors_count
        );
      });

      // Insert new questions and get real UUIDs
      const tempToReal = new Map();
      if (questionsToInsert.length > 0) {
        const { data, error } = await dbHelpers.addQuestions(theme.id, questionsToInsert);
        if (error) {
          console.error('Error saving questions:', error);
        } else if (data) {
          questionsToInsert.forEach((q, i) => {
            if (data[i]) tempToReal.set(q.id, data[i].id);
          });
        }
      }

      // Delete removed questions
      if (deletedQuestionIds.length > 0) {
        const { error } = await dbHelpers.deleteQuestions(deletedQuestionIds);
        if (error) console.error('Error deleting questions:', error);
      }

      // Update SRS data
      for (const q of srsUpdates) {
        const { error } = await dbHelpers.updateQuestion(q.id, {
          stability: q.stability,
          srs_difficulty: q.srs_difficulty,
          next_review: q.next_review,
          last_review: q.last_review,
          attempts: q.attempts,
          errors_count: q.errors_count,
        });
        if (error) console.error('Error updating SRS for question:', q.id, error);
      }

      // 3. Documents persistence
      const docsToInsert = newDocs.filter(d => !isRealId(d.id));
      const deletedDocIds = oldDocs
        .filter(d => isRealId(d.id) && !newDocs.find(nd => nd.id === d.id))
        .map(d => d.id);

      // Insert new documents and collect real IDs
      const savedDocs = [];
      for (const doc of docsToInsert) {
        const { data, error } = await dbHelpers.addDocument(theme.id, {
          type: doc.type,
          content: doc.content || null,
          file_name: doc.fileName || null,
          processed_content: doc.processedContent || null,
          search_results: doc.searchResults || null,
        });
        if (error) {
          console.error('Error saving document:', error);
          savedDocs.push(null);
        } else {
          savedDocs.push(data);
        }
      }

      // Delete removed documents
      for (const docId of deletedDocIds) {
        const { error } = await dbHelpers.deleteDocument(docId);
        if (error) console.error('Error deleting document:', error);
      }

      // 4. Merge real IDs into state
      let insertIdx = 0;
      const finalDocs = newDocs.map(d => {
        if (isRealId(d.id)) return d;
        const saved = savedDocs[insertIdx++];
        return saved ? { ...d, id: saved.id } : d;
      });

      const finalQuestions = newQuestions.map(q =>
        tempToReal.has(q.id) ? { ...q, id: tempToReal.get(q.id) } : q
      );

      setThemes(prev => prev.map(t =>
        t.number === theme.number
          ? { ...theme, questions: finalQuestions, documents: finalDocs }
          : t
      ));
    } catch (error) {
      console.error('Error in updateTheme:', error);
      setThemes(prev => prev.map(t => t.number === theme.number ? theme : t));
    }
  };

  const saveExamResult = async (examConfig, score) => {
    const result = {
      ...score,
      date: new Date().toISOString(),
      numQuestions: examConfig.numQuestions
    };

    setExamHistory(prev => [result, ...prev]);

    if (currentUser && !currentUser.isGuest) {
      try {
        await dbHelpers.saveExamResult(currentUser.id, examConfig, score);
      } catch (error) {
        console.error('Error saving exam result:', error);
      }
    }
  };

  const resetData = () => {
    setThemes([]);
    setExamHistory([]);
    setProfile(null);
    setLoading(false);
  };

  const stats = {
    totalExams: examHistory.length,
    totalQuestions: examHistory.reduce((s, e) => s + (e.numQuestions || 0), 0),
    avgScore: examHistory.length > 0
      ? Math.round(examHistory.reduce((s, e) => s + parseFloat(e.percentage), 0) / examHistory.length)
      : 0,
    themesCompleted: themes.filter(t => t.questions?.length > 0).length
  };

  return {
    themes,
    setThemes,
    examHistory,
    setExamHistory,
    profile,
    setProfile,
    loading,
    setLoading,
    updateTheme,
    saveExamResult,
    resetData,
    stats,
  };
};

export default useUserData;
