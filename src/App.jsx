import React, { useState, useEffect, useMemo, useRef } from 'react';

// Hooks
import useAuth from './hooks/useAuth';
import useToast from './hooks/useToast';
import useUserData from './hooks/useUserData';
import useGenerationQueue from './hooks/useGenerationQueue';
import useExamLifecycle from './hooks/useExamLifecycle';
import useSRSNotifications from './hooks/useSRSNotifications';

// Context
import { ThemeProvider } from './context/ThemeContext';

// Utils
import { getSRSStats } from './utils/srs';
import { exportData, importData } from './utils/exportImport';

// Common components
import ToastContainer from './components/common/ToastContainer';
import { AuthLoadingScreen } from './components/common/LoadingScreens';
import GenerationBanner from './components/common/GenerationBanner';

// Layout
import AppScreens from './components/layout/AppScreens';
import BottomNav from './components/layout/BottomNav';

// Auth screens
import AuthScreen from './components/auth/AuthScreen';
import OnboardingScreen from './components/auth/OnboardingScreen';
import UserProfileModal from './components/auth/UserProfileModal';

// Plans
import JoinPlanScreen from './components/plans/JoinPlanScreen';

export default function App() {
  // ─── Navigation ────────────────────────────────────────────
  const [screen, setScreen] = useState('home');
  const [showUserProfile, setShowUserProfile] = useState(false);

  // ─── Join plan via ?join=slug OR manual code from HomeScreen ──
  const [joinSlug, setJoinSlug] = useState(() =>
    new URLSearchParams(window.location.search).get('join') || null
  );
  useEffect(() => {
    if (joinSlug) window.history.replaceState({}, '', '/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinWithCode = (slug) => setJoinSlug(slug);

  // ─── Dark mode ─────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try { localStorage.setItem('darkMode', darkMode); } catch {}
  }, [darkMode]);

  // ─── Core hooks ────────────────────────────────────────────
  const { toasts, showToast, removeToast } = useToast();
  const auth = useAuth();
  const userData = useUserData(auth.isAuthenticated, auth.currentUser, showToast);

  // ─── Generation queue ──────────────────────────────────────
  const themesRef = useRef(userData.themes);
  useEffect(() => { themesRef.current = userData.themes; }, [userData.themes]);
  const genQueue = useGenerationQueue({ themesRef, onUpdateTheme: userData.updateTheme, showToast });

  // ─── SRS ───────────────────────────────────────────────────
  const srsStats = useMemo(() => getSRSStats(userData.themes), [userData.themes]);

  // ─── SRS notifications ─────────────────────────────────────
  useSRSNotifications({
    dueCount: srsStats.dueQuestions?.length,
    notificationsEnabled: userData.profile?.notifications,
  });

  // ─── Current user with role ─────────────────────────────────
  const currentUserWithRole = auth.currentUser
    ? { ...auth.currentUser, role: auth.currentUser.role || auth.currentUser.user_metadata?.role }
    : null;
  const isAcademy = currentUserWithRole?.role === 'academy';

  // ─── Auth handlers ─────────────────────────────────────────
  const handleOnboardingComplete = (newProfile, updatedUser) => {
    const profile = auth.handleOnboardingComplete(newProfile, updatedUser);
    userData.setProfile(profile);
  };

  const handleLogout = async () => {
    await auth.handleLogout();
    userData.resetData();
    setScreen('home');
  };

  // ─── Exam lifecycle ────────────────────────────────────────
  const { examConfig, reviewFailed, setReviewFailed, startExam, finishExam } = useExamLifecycle({
    saveExamResult: userData.saveExamResult,
    setScreen,
  });

  // ─── Export / Import ───────────────────────────────────────
  const activeTest = userData.tests?.find(t => t.id === userData.activeTestId);
  const activeTestIsCloned = !!(activeTest?.cloned_from);

  const handleExportData = () => {
    if (activeTestIsCloned) { showToast('No puedes exportar un plan oficial compartido.', 'error'); return; }
    const stats = exportData(userData.themes, activeTest?.name || 'Mi Test');
    showToast(`✅ Exportadas ${stats.totalQuestions} preguntas de ${stats.totalThemes} temas`, 'success');
  };

  const handleImportData = async (file) => {
    if (activeTestIsCloned) { showToast('No puedes importar preguntas en un plan oficial compartido.', 'error'); return { importedThemes: 0, importedQuestions: 0 }; }
    return importData(file, userData.themes, userData.updateTheme);
  };

  // ─── Loading / Auth gates ──────────────────────────────────
  if (auth.authLoading) return <AuthLoadingScreen darkMode={darkMode} />;

  if (!auth.isAuthenticated) return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <AuthScreen onLogin={auth.handleLogin} showToast={showToast} />
    </>
  );

  if (auth.showOnboarding) return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <OnboardingScreen
        user={currentUserWithRole}
        onComplete={handleOnboardingComplete}
        showToast={showToast}
      />
    </>
  );

  if (joinSlug && auth.isAuthenticated && !auth.authLoading && !userData.loading) return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <JoinPlanScreen
        slug={joinSlug}
        currentUser={auth.currentUser}
        onSuccess={(testId) => { setJoinSlug(null); userData.switchTest(testId); setScreen('themes'); }}
        onCancel={() => { setJoinSlug(null); setScreen('home'); }}
        onGoToLogin={() => { setJoinSlug(null); auth.handleLogout(); }}
      />
    </>
  );

  // ─── Main app ──────────────────────────────────────────────
  return (
    <ThemeProvider darkMode={darkMode}>
      <div className={darkMode ? 'dark-mode' : ''}>
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

        <AppScreens
          screen={screen}
          setScreen={setScreen}
          isAcademy={isAcademy}
          currentUserWithRole={currentUserWithRole}
          userData={userData}
          activeTest={activeTest}
          activeTestIsCloned={activeTestIsCloned}
          examConfig={examConfig}
          reviewFailed={reviewFailed}
          setReviewFailed={setReviewFailed}
          startExam={startExam}
          finishExam={finishExam}
          genQueue={genQueue}
          showToast={showToast}
          handleExportData={handleExportData}
          handleImportData={handleImportData}
          handleJoinWithCode={handleJoinWithCode}
          onShowProfile={() => setShowUserProfile(true)}
          setDarkMode={setDarkMode}
          darkMode={darkMode}
          srsStats={srsStats}
        />

        <GenerationBanner progress={genQueue.queueProgress} />
        <BottomNav current={screen} onNavigate={setScreen} isAcademy={isAcademy} />
      </div>
    </ThemeProvider>
  );
}
