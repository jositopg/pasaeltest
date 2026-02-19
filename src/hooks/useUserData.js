import { useState, useEffect } from 'react';
import { dbHelpers } from '../supabaseClient';
import { DEFAULT_PROFILE } from '../utils/constants';

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
          documents: theme.documents || [],
          questions: theme.questions || []
        })));
      } else {
        // Create initial themes in Supabase
        const initialThemes = createInitialThemes();
        for (const theme of initialThemes) {
          await dbHelpers.createTheme(currentUser.id, {
            number: theme.number,
            name: theme.name
          });
        }
        const { data: newThemesData } = await dbHelpers.getThemes(currentUser.id);
        if (newThemesData) {
          setThemes(newThemesData.map(theme => ({
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
    
    try {
      if (theme.id) {
        const { error } = await dbHelpers.updateTheme(theme.id, {
          name: theme.name,
          number: theme.number
        });
        if (error) {
          console.error('Error updating theme:', error);
          return;
        }
      }
      setThemes(prev => prev.map(t => t.number === theme.number ? theme : t));
    } catch (error) {
      console.error('Error in updateTheme:', error);
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
