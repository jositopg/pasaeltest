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

export default function AppScreens({
  screen,
  setScreen,
  isAcademy,
  // auth
  currentUserWithRole,
  // userData
  userData,
  activeTest,
  activeTestIsCloned,
  // exam lifecycle
  examConfig,
  reviewFailed,
  setReviewFailed,
  startExam,
  finishExam,
  // misc
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
    <ScreenErrorBoundary screen={screen} onNavigate={setScreen}>

      {screen === 'home' && (
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
      )}

      {screen === 'exams' && (
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
          currentUser={currentUserWithRole}
          isClonedTest={activeTestIsCloned}
          loading={userData.loading}
        />
      )}

      {screen === 'exam' && !isAcademy && (
        <ExamConfigScreen
          themes={userData.themes}
          onStartExam={startExam}
          onNavigate={setScreen}
          tests={userData.tests}
          activeTestId={userData.activeTestId}
          onSwitchTest={userData.switchTest}
        />
      )}

      {screen === 'exam-active' && !isAcademy && (
        <ExamScreen
          config={examConfig}
          themes={userData.themes}
          onFinish={finishExam}
          onNavigate={setScreen}
          onUpdateThemes={userData.updateTheme}
          examHistory={userData.examHistory}
        />
      )}

      {screen === 'review' && !isAcademy && (
        <ReviewScreen
          dueQuestions={reviewFailed || srsStats.dueQuestions}
          themes={userData.themes}
          onUpdateTheme={userData.updateTheme}
          onNavigate={(s) => { setReviewFailed(null); setScreen(s); }}
          showToast={showToast}
          mode={reviewFailed ? 'exam-fails' : 'srs'}
        />
      )}

      {screen === 'alumnos' && (
        <AcademyStudentsScreen
          onNavigate={setScreen}
          onSwitchTest={userData.switchTest}
        />
      )}

      {screen === 'stats' && (
        <StatsScreen
          examHistory={userData.examHistory}
          onNavigate={setScreen}
          themes={userData.themes}
        />
      )}

      {screen === 'questions' && !isAcademy && (
        <QuestionsScreen
          themes={userData.themes}
          onUpdateTheme={userData.updateTheme}
          onNavigate={setScreen}
          showToast={showToast}
          activeTestName={activeTest?.name}
          loading={userData.loading}
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
          onToggleDark={() => setDarkMode(!darkMode)}
          profile={userData.profile}
          onUpdateProfile={userData.setProfile}
          user={currentUserWithRole}
          onExportData={handleExportData}
          onImportData={handleImportData}
          isClonedTest={activeTestIsCloned}
        />
      )}

      {screen === 'admin' && (
        <AdminScreen onNavigate={setScreen} />
      )}

    </ScreenErrorBoundary>
  );
}
