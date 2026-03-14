import React from 'react';

/**
 * ErrorBoundary — captura errores de React en el árbol de componentes.
 *
 * Uso global (main.jsx):
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Uso por pantalla (App.jsx), muestra solo la pantalla en error, no toda la app:
 *   <ScreenErrorBoundary screen="themes" onNavigate={setScreen}>
 *     <ThemesScreen ... />
 *   </ScreenErrorBoundary>
 */

// ─── Full-page boundary (wraps entire app in main.jsx) ──────────────────────

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Error capturado:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDark = localStorage.getItem('darkMode') === 'true';

    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'
        }`}
      >
        <div className={`w-full max-w-md rounded-2xl p-8 text-center shadow-xl ${
          isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
        }`}>
          {/* Icono */}
          <div className="text-5xl mb-4">⚠️</div>

          <h1 className="text-xl font-bold mb-2">Algo ha ido mal</h1>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Ha ocurrido un error inesperado. Tus datos están seguros en Supabase — recarga la página para continuar.
          </p>

          {/* Detalle del error (solo en dev) */}
          {import.meta.env.DEV && this.state.error && (
            <pre className={`text-left text-xs rounded-lg p-3 mb-6 overflow-auto max-h-32 ${
              isDark ? 'bg-gray-800 text-red-400' : 'bg-red-50 text-red-700'
            }`}>
              {this.state.error.toString()}
            </pre>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
          >
            Recargar app
          </button>

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className={`w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-all ${
              isDark
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Intentar continuar
          </button>
        </div>
      </div>
    );
  }
}

// ─── Per-screen boundary (wraps individual screens in App.jsx) ───────────────

export class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(`[ScreenErrorBoundary:${this.props.screen}] Error:`, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDark = localStorage.getItem('darkMode') === 'true';

    return (
      <div className={`flex flex-col items-center justify-center min-h-[60vh] p-6 text-center ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}>
        <div className="text-4xl mb-4">😵</div>
        <h2 className="text-lg font-bold mb-2">Esta pantalla ha fallado</h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          El resto de la app sigue funcionando.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-5 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm"
          >
            Reintentar
          </button>
          {this.props.onNavigate && (
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onNavigate('home');
              }}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ir al inicio
            </button>
          )}
        </div>
      </div>
    );
  }
}
