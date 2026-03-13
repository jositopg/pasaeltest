import React, { useState, useEffect, useMemo, useRef } from 'react';

// Hooks
import useAuth from './hooks/useAuth';
import useToast from './hooks/useToast';
import useUserData from './hooks/useUserData';
import useGenerationQueue from './hooks/useGenerationQueue';

// Context
import { ThemeProvider } from './context/ThemeContext';

// Utils
import { getSRSStats, getDueQuestions } from './utils/srs';
import { exportData, importData } from './utils/exportImport';
import { supabase } from './supabaseClient';

// Common components
import ToastContainer from './components/common/ToastContainer';
import { AuthLoadingScreen, DataLoadingScreen } from './components/common/LoadingScreens';
import GenerationBanner from './components/common/GenerationBanner';

// Screen components
import AuthScreen from './components/auth/AuthScreen';
import OnboardingScreen from './components/auth/OnboardingScreen';
import UserProfileModal from './components/auth/UserProfileModal';
import HomeScreen from './components/home/HomeScreen';
import ThemesScreen from './components/themes/ThemesScreen';
import ExamConfigScreen from './components/exam/ExamConfigScreen';
import ExamScreen from './components/exam/ExamScreen';
import ReviewScreen from './components/review/ReviewScreen';
import StatsScreen from './components/stats/StatsScreen';
import HeatmapScreen from './components/stats/HeatmapScreen';
import SettingsScreen from './components/settings/SettingsScreen';
import BottomNav from './components/layout/BottomNav';
import QuestionsScreen from './components/questions/QuestionsScreen';
import AdminScreen from './components/admin/AdminScreen';
import JoinPlanScreen from './components/plans/JoinPlanScreen';
import ExamsScreen from './components/exams/ExamsScreen';

export default function App() {
  // ─── Navigation ────────────────────────────────────────────
  const [screen, setScreen] = useState('home');
  const [examConfig, setExamConfig] = useState(null);
  const [reviewFailed, setReviewFailed] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // ─── Join plan via ?join=slug OR manual code from HomeScreen ──
  const [joinSlug, setJoinSlug] = useState(() =>
    new URLSearchParams(window.location.search).get('join') || null
  );
  useEffect(() => {
    if (joinSlug) window.history.replaceState({}, '', '/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinWithCode = (slug) => {
    setJoinSlug(slug);
  };

  // ─── Dark mode ─────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true'; } catch { return false; }
  });
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try { localStorage.setItem('darkMode', darkMode); } catch {}
  }, [darkMode]);

  const dm = darkMode;

  // ─── Core hooks ────────────────────────────────────────────
  const { toasts, showToast, removeToast } = useToast();
  const auth = useAuth();
  const userData = useUserData(auth.isAuthenticated, auth.currentUser);

  // ─── Generation queue (persists across navigation) ─────────
  const themesRef = useRef(userData.themes);
  useEffect(() => { themesRef.current = userData.themes; }, [userData.themes]);
  const genQueue = useGenerationQueue({ themesRef, onUpdateTheme: userData.updateTheme, showToast });

  // ─── SRS ───────────────────────────────────────────────────
  const srsStats = useMemo(() => {
    return getSRSStats(userData.themes);
  }, [userData.themes]);

  // ─── Notificaciones SRS ────────────────────────────────────
  useEffect(() => {
    if (!userData.profile?.notifications) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const due = srsStats.dueQuestions?.length;
    if (!due) return;

    const lastRaw = localStorage.getItem('lastSRSNotification');
    const last = lastRaw ? parseInt(lastRaw) : 0;
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    if (Date.now() - last < FOUR_HOURS) return;

    try {
      new Notification('PasaElTest — Repaso pendiente 🧠', {
        body: `Tienes ${due} pregunta${due !== 1 ? 's' : ''} por repasar hoy.`,
        icon: '/pwa-192x192.png',
        tag: 'srs-reminder',
      });
      localStorage.setItem('lastSRSNotification', Date.now().toString());
    } catch {}
  }, [srsStats.dueQuestions?.length, userData.profile?.notifications]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleLogin = (user) => {
    auth.handleLogin(user);
  };

  // Enrich currentUser with role from login payload (stored in user_metadata at signup)
  const currentUserWithRole = auth.currentUser
    ? {
        ...auth.currentUser,
        role: auth.currentUser.role || auth.currentUser.user_metadata?.role,
      }
    : null;

  const handleOnboardingComplete = (newProfile, updatedUser) => {
    const profile = auth.handleOnboardingComplete(newProfile, updatedUser);
    userData.setProfile(profile);
  };

  const handleLogout = async () => {
    await auth.handleLogout();
    userData.resetData();
    setScreen('home');
  };

  const startExam = (config) => {
    setExamConfig(config);
    setScreen('exam-active');
  };

  // ─── Exportar / Importar ────────────────────────────────────
  const activeTest = userData.tests?.find(t => t.id === userData.activeTestId);
  const activeTestIsCloned = !!(activeTest?.cloned_from);

  const handleExportData = () => {
    if (activeTestIsCloned) {
      showToast('No puedes exportar un plan oficial compartido.', 'error');
      return;
    }
    const stats = exportData(userData.themes, activeTest?.name || 'Mi Test');
    showToast(`✅ Exportadas ${stats.totalQuestions} preguntas de ${stats.totalThemes} temas`, 'success');
  };

  const handleImportData = async (file) => {
    if (activeTestIsCloned) {
      showToast('No puedes importar preguntas en un plan oficial compartido.', 'error');
      return { importedThemes: 0, importedQuestions: 0 };
    }
    const result = await importData(file, userData.themes, userData.updateTheme);
    return result;
  };

  const finishExam = async (score, flags = [], reviewQs = null) => {
    await userData.saveExamResult(examConfig, score);
    if (reviewQs?.length > 0) {
      setReviewFailed(reviewQs);
      setScreen('review');
    } else {
      setReviewFailed(null);
      setScreen('home');
    }

    // Enviar reportes de preguntas (fire-and-forget)
    if (flags.length > 0) {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }));
      if (session?.access_token) {
        flags.forEach(({ question, comment }) => {
          fetch('/api/report-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
              questionId: question.id,
              userComment: comment,
              questionSnapshot: {
                text: question.text,
                options: question.options,
                correct_answer: question.correct ?? question.correct_answer,
                explanation: question.explanation,
              },
            }),
          }).catch(() => {});
        });
      }
    }
  };

  // ─── Loading states ────────────────────────────────────────
  if (auth.authLoading) {
    return <AuthLoadingScreen darkMode={dm} />;
  }

  if (!auth.isAuthenticated) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <AuthScreen onLogin={handleLogin} showToast={showToast} />
      </>
    );
  }

  if (auth.showOnboarding) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <OnboardingScreen
          user={currentUserWithRole}
          onComplete={handleOnboardingComplete}
          showToast={showToast}
        />
      </>
    );
  }

  if (userData.loading) {
    return <DataLoadingScreen darkMode={dm} />;
  }

  // ─── Join plan gate ─────────────────────────────────────────
  if (joinSlug && auth.isAuthenticated && !auth.authLoading && !userData.loading) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <JoinPlanScreen
          slug={joinSlug}
          currentUser={auth.currentUser}
          onSuccess={(testId) => {
            setJoinSlug(null);
            userData.switchTest(testId);
            setScreen('themes');
          }}
          onCancel={() => { setJoinSlug(null); setScreen('home'); }}
          onGoToLogin={() => { setJoinSlug(null); auth.handleLogout(); }}
        />
      </>
    );
  }

  // ─── Main app ──────────────────────────────────────────────
  return (
    <ThemeProvider darkMode={dm}>
      <div className={dm ? 'dark-mode' : ''}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {showUserProfile && (
          <UserProfileModal
            user={currentUserWithRole}
            profile={userData.profile}
            onClose={() => setShowUserProfile(false)}
            onLogout={handleLogout}
            onUpdateProfile={userData.setProfile}
            showToast={showToast}
          />
        )}

        {screen === 'home' && (
          <HomeScreen
            onNavigate={setScreen}
            profile={userData.profile}
            user={currentUserWithRole}
            onShowProfile={() => setShowUserProfile(true)}
            srsStats={srsStats}
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            themes={userData.themes}
            onSwitchTest={userData.switchTest}
            onJoinWithCode={handleJoinWithCode}
          />
        )}
        {screen === 'exams' && (
          <ExamsScreen
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            themes={userData.themes}
            onSwitchTest={userData.switchTest}
            onCreateTest={userData.createTest}
            onRenameTest={userData.renameTest}
            onDeleteTest={userData.deleteTest}
            onNavigate={setScreen}
            currentUser={auth.currentUser}
            showToast={showToast}
          />
        )}
        {screen === 'themes' && (
          <ThemesScreen
            themes={userData.themes}
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            onUpdateTheme={userData.updateTheme}
            onAddTheme={userData.addTheme}
            onAddThemesBatch={userData.addThemesBatch}
            onCreateTest={userData.createTest}
            onSwitchTest={userData.switchTest}
            onRenameTest={userData.renameTest}
            onDeleteTest={userData.deleteTest}
            onNavigate={setScreen}
            showToast={showToast}
            genQueue={genQueue}
            currentUser={auth.currentUser}
            isClonedTest={activeTestIsCloned}
          />
        )}
        {screen === 'exam' && (
          <ExamConfigScreen
            themes={userData.themes}
            onStartExam={startExam}
            onNavigate={setScreen}
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            onSwitchTest={userData.switchTest}
          />
        )}
        {screen === 'exam-active' && (
          <ExamScreen
            config={examConfig}
            themes={userData.themes}
            onFinish={finishExam}
            onNavigate={setScreen}
            onUpdateThemes={userData.updateTheme}
          />
        )}
        {screen === 'review' && (
          <ReviewScreen
            dueQuestions={reviewFailed || srsStats.dueQuestions}
            themes={userData.themes}
            onUpdateTheme={userData.updateTheme}
            onNavigate={(s) => { setReviewFailed(null); setScreen(s); }}
            showToast={showToast}
          />
        )}
        {screen === 'stats' && (
          <StatsScreen
            examHistory={userData.examHistory}
            onNavigate={setScreen}
            themes={userData.themes}
          />
        )}
        {screen === 'questions' && (
          <QuestionsScreen
            themes={userData.themes}
            onUpdateTheme={userData.updateTheme}
            onNavigate={setScreen}
            showToast={showToast}
            activeTestName={activeTest?.name}
          />
        )}
        {screen === 'heatmap' && (
          <HeatmapScreen
            themes={userData.themes}
            onNavigate={setScreen}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen
            onNavigate={setScreen}
            onToggleDark={() => setDarkMode(!dm)}
            profile={userData.profile}
            onUpdateProfile={userData.setProfile}
            user={auth.currentUser}
            onExportData={handleExportData}
            onImportData={handleImportData}
            isClonedTest={activeTestIsCloned}
          />
        )}
        {screen === 'admin' && (
          <AdminScreen onNavigate={setScreen} />
        )}
        <GenerationBanner progress={genQueue.queueProgress} />
        <BottomNav current={screen} onNavigate={setScreen} />
      </div>
    </ThemeProvider>
  );
}
