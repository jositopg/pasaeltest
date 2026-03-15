import React from 'react';
import { ScreenErrorBoundary } from '../common/ErrorBoundary';

import HomeScreen from '../home/HomeScreen';
import ExamsScreen from '../exams/ExamsScreen';
import ThemesScreen from '../themes/ThemesScreen';
import ExamConfigScreen from '../exam/ExamConfigScreen';
import ExamScreen from '../exam/ExamScreen';
import ReviewScreen from '../review/ReviewScreen';
import AcademyStudentsScreen from '../academy/AcademyStudentsScreen';
import StatsScreen from '../stats/StatsScreen';
import QuestionsScreen from '../questions/QuestionsScreen';
import HeatmapScreen from '../stats/HeatmapScreen';
import SettingsScreen from '../settings/SettingsScreen';
import AdminScreen from '../admin/AdminScreen';

// Helper to wrap each screen in its own ScreenErrorBoundary
function Screen({ name, onNavigate, children }) {
  return (
    <ScreenErrorBoundary screen={name} onNavigate={onNavigate}>
      {children}
    </ScreenErrorBoundary>
  );
}

export default function AppScreens({
  screen,
  setScreen,
  isAcademy,
  currentUserWithRole,
  userData,
  activeTest,
  activeTestIsCloned,
  examConfig,
  reviewFailed,
  setReviewFailed,
  startExam,
  finishExam,
  genQueue,
  showToast,
  handleExportData,
  handleImportData,
  handleJoinWithCode,
  onShowProfile,
  setDarkMode,
  darkMode,
  srsStats,
}) {
  return (
    <>
      {screen === 'home' && (
        <Screen name="home" onNavigate={setScreen}>
          <HomeScreen
            onNavigate={setScreen}
            profile={userData.profile}
            user={currentUserWithRole}
            onShowProfile={onShowProfile}
            srsStats={srsStats}
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            themes={userData.themes}
            onSwitchTest={userData.switchTest}
            onJoinWithCode={handleJoinWithCode}
          />
        </Screen>
      )}

      {screen === 'exams' && (
        <Screen name="exams" onNavigate={setScreen}>
          <ExamsScreen
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            themes={userData.themes}
            onSwitchTest={userData.switchTest}
            onCreateTest={userData.createTest}
            onRenameTest={userData.renameTest}
            onUpdateTestEmoji={userData.updateTestEmoji}
            onDeleteTest={userData.deleteTest}
            onNavigate={setScreen}
            currentUser={currentUserWithRole}
            showToast={showToast}
          />
        </Screen>
      )}

      {screen === 'themes' && (
        <Screen name="themes" onNavigate={setScreen}>
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
            currentUser={currentUserWithRole}
            isClonedTest={activeTestIsCloned}
            loading={userData.loading}
          />
        </Screen>
      )}

      {screen === 'exam' && !isAcademy && (
        <Screen name="exam" onNavigate={setScreen}>
          <ExamConfigScreen
            themes={userData.themes}
            onStartExam={startExam}
            onNavigate={setScreen}
            tests={userData.tests}
            activeTestId={userData.activeTestId}
            onSwitchTest={userData.switchTest}
          />
        </Screen>
      )}

      {screen === 'exam-active' && !isAcademy && (
        <Screen name="exam-active" onNavigate={setScreen}>
          <ExamScreen
            config={examConfig}
            themes={userData.themes}
            onFinish={finishExam}
            onNavigate={setScreen}
            onUpdateThemes={userData.updateTheme}
            examHistory={userData.examHistory}
          />
        </Screen>
      )}

      {screen === 'review' && !isAcademy && (
        <Screen name="review" onNavigate={setScreen}>
          <ReviewScreen
            dueQuestions={reviewFailed || srsStats.dueQuestions}
            themes={userData.themes}
            onUpdateTheme={userData.updateTheme}
            onNavigate={(s) => { setReviewFailed(null); setScreen(s); }}
            showToast={showToast}
            mode={reviewFailed ? 'exam-fails' : 'srs'}
          />
        </Screen>
      )}

      {screen === 'alumnos' && (
        <Screen name="alumnos" onNavigate={setScreen}>
          <AcademyStudentsScreen
            onNavigate={setScreen}
            onSwitchTest={userData.switchTest}
          />
        </Screen>
      )}

      {screen === 'stats' && (
        <Screen name="stats" onNavigate={setScreen}>
          <StatsScreen
            examHistory={userData.examHistory}
            onNavigate={setScreen}
            themes={userData.themes}
          />
        </Screen>
      )}

      {screen === 'questions' && !isAcademy && (
        <Screen name="questions" onNavigate={setScreen}>
          <QuestionsScreen
            themes={userData.themes}
            onUpdateTheme={userData.updateTheme}
            onNavigate={setScreen}
            showToast={showToast}
            activeTestName={activeTest?.name}
            loading={userData.loading}
          />
        </Screen>
      )}

      {screen === 'heatmap' && (
        <Screen name="heatmap" onNavigate={setScreen}>
          <HeatmapScreen
            themes={userData.themes}
            onNavigate={setScreen}
          />
        </Screen>
      )}

      {screen === 'settings' && (
        <Screen name="settings" onNavigate={setScreen}>
          <SettingsScreen
            onNavigate={setScreen}
            onToggleDark={() => setDarkMode(!darkMode)}
            profile={userData.profile}
            onUpdateProfile={userData.setProfile}
            user={currentUserWithRole}
            onExportData={handleExportData}
            onImportData={handleImportData}
            isClonedTest={activeTestIsCloned}
          />
        </Screen>
      )}

      {screen === 'admin' && (
        <Screen name="admin" onNavigate={setScreen}>
          <AdminScreen onNavigate={setScreen} />
        </Screen>
      )}
    </>
  );
}
