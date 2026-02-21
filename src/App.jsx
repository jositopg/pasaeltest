import React, { useState, useEffect, useMemo } from 'react';

// Hooks
import useAuth from './hooks/useAuth';
import useToast from './hooks/useToast';
import useUserData from './hooks/useUserData';

// Utils
import { getSRSStats, getDueQuestions } from './utils/srs';

// Common components
import ToastContainer from './components/common/ToastContainer';
import { AuthLoadingScreen, DataLoadingScreen } from './components/common/LoadingScreens';

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

export default function App() {
  // ─── Navigation ────────────────────────────────────────────
  const [screen, setScreen] = useState('home');
  const [examConfig, setExamConfig] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

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

  // ─── SRS ───────────────────────────────────────────────────
  const srsStats = useMemo(() => {
    return getSRSStats(userData.themes);
  }, [userData.themes]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleLogin = (user) => {
    auth.handleLogin(user);
  };

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

  const finishExam = async (score) => {
    await userData.saveExamResult(examConfig, score);
    setScreen('home');
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
          user={auth.currentUser} 
          onComplete={handleOnboardingComplete}
          showToast={showToast}
        />
      </>
    );
  }

  if (userData.loading) {
    return <DataLoadingScreen darkMode={dm} />;
  }

  // ─── Main app ──────────────────────────────────────────────
  return (
    <div className={dm ? 'dark-mode' : ''}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {showUserProfile && (
        <UserProfileModal
          user={auth.currentUser}
          profile={userData.profile}
          onClose={() => setShowUserProfile(false)}
          onLogout={handleLogout}
          onUpdateProfile={userData.setProfile}
          showToast={showToast}
          darkMode={dm}
        />
      )}
      
      {screen === 'home' && (
        <HomeScreen 
          onNavigate={setScreen} 
          stats={userData.stats} 
          profile={userData.profile}
          user={auth.currentUser}
          onShowProfile={() => setShowUserProfile(true)}
          darkMode={dm}
          srsStats={srsStats}
        />
      )}
      {screen === 'themes' && (
        <ThemesScreen 
          themes={userData.themes} 
          onUpdateTheme={userData.updateTheme} 
          onNavigate={setScreen} 
          showToast={showToast} 
          darkMode={dm} 
        />
      )}
      {screen === 'exam' && (
        <ExamConfigScreen 
          themes={userData.themes} 
          onStartExam={startExam} 
          onNavigate={setScreen} 
          darkMode={dm} 
        />
      )}
      {screen === 'exam-active' && (
        <ExamScreen 
          config={examConfig} 
          themes={userData.themes} 
          onFinish={finishExam} 
          onNavigate={setScreen} 
          onUpdateThemes={userData.updateTheme}
          darkMode={dm}
        />
      )}
      {screen === 'review' && (
        <ReviewScreen
          dueQuestions={srsStats.dueQuestions}
          themes={userData.themes}
          onUpdateTheme={userData.updateTheme}
          onNavigate={setScreen}
          showToast={showToast}
          darkMode={dm}
        />
      )}
      {screen === 'stats' && (
        <StatsScreen 
          examHistory={userData.examHistory} 
          onNavigate={setScreen} 
          themes={userData.themes} 
          darkMode={dm} 
        />
      )}
      {screen === 'heatmap' && (
        <HeatmapScreen 
          themes={userData.themes} 
          onNavigate={setScreen} 
          darkMode={dm} 
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen 
          onNavigate={setScreen} 
          darkMode={dm} 
          onToggleDark={() => setDarkMode(!dm)} 
        />
      )}
      <BottomNav current={screen} onNavigate={setScreen} darkMode={dm} />
    </div>
  );
}
