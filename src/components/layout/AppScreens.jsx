import { Suspense, lazy } from 'react';
import { ScreenErrorBoundary } from '../common/ErrorBoundary';

// Critical path — loaded eagerly
import HomeScreen from '../home/HomeScreen';

// Non-critical — loaded on demand
const ExamsScreen           = lazy(() => import('../exams/ExamsScreen'));
const ThemesScreen          = lazy(() => import('../themes/ThemesScreen'));
const ExamConfigScreen      = lazy(() => import('../exam/ExamConfigScreen'));
const ExamScreen            = lazy(() => import('../exam/ExamScreen'));
const ReviewScreen          = lazy(() => import('../review/ReviewScreen'));
const AcademyStudentsScreen = lazy(() => import('../academy/AcademyStudentsScreen'));
const StatsScreen           = lazy(() => import('../stats/StatsScreen'));
const QuestionsScreen       = lazy(() => import('../questions/QuestionsScreen'));
const HeatmapScreen         = lazy(() => import('../stats/HeatmapScreen'));
const SettingsScreen        = lazy(() => import('../settings/SettingsScreen'));
const AdminScreen           = lazy(() => import('../admin/AdminScreen'));

function ScreenFallback({ darkMode }) {
  return (
    <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
  const fallback = <ScreenFallback darkMode={darkMode} />;

  return (
    <Suspense fallback={fallback}>
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
    </Suspense>
  );
}
