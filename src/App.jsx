import React, { useState, useEffect, useRef } from 'react';
import { supabase, authHelpers, dbHelpers } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════
const DEBUG = false; // Cambiar a true para ver console.logs

// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`pointer-events-auto transform transition-all duration-300 ease-out ${
          toast.removing ? 'translate-x-96 opacity-0' : 'translate-x-0 opacity-100'
        }`}
      >
        <div className={`rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-md backdrop-blur-xl border ${
          toast.type === 'success' ? 'bg-green-500/95 text-white border-green-400' :
          toast.type === 'error' ? 'bg-red-500/95 text-white border-red-400' :
          toast.type === 'warning' ? 'bg-yellow-500/95 text-white border-yellow-400' :
          'bg-blue-500/95 text-white border-blue-400'
        }`}>
          <span className="text-xl flex-shrink-0">
            {toast.type === 'success' ? '✅' :
             toast.type === 'error' ? '❌' :
             toast.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <p className="flex-1 font-medium text-sm">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    ))}
  </div>
);

// Hook para manejar toasts
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random(); // Asegurar unicidad
    setToasts(prev => [...prev, { id, message, type, removing: false }]);
    
    // Auto-remove después de 3 segundos
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  return { toasts, showToast, removeToast };
};

// ═══════════════════════════════════════════════════════════════════════
// STORAGE UTILS - MIGRADO A SUPABASE
// ═══════════════════════════════════════════════════════════════════════
// Se usa dbHelpers de supabaseClient.js en lugar de window.storage

// ═══════════════════════════════════════════════════════════════════════
// AUTHENTICATION & USER SCREENS
// ═══════════════════════════════════════════════════════════════════════

// Pantalla de Login/Registro
function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    oposicion: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🚀 MVP MODE: Modo desarrollo simplificado
  // Auth con Supabase (producción)
  const MVP_MODE = false;

  const handleGuestMode = () => {
    // Crear usuario temporal/invitado
    const guestUser = {
      id: `guest-${Date.now()}`,
      email: 'guest@temp.com',
      name: 'Invitado',
      oposicion: 'Demo',
      createdAt: new Date().toISOString(),
      subscription: 'free',
      isGuest: true,
      isFirstLogin: true
    };
    
    onLogin(guestUser);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // LOGIN con Supabase
        const { data, error } = await authHelpers.signIn(
          formData.email,
          formData.password
        );
        
        if (error) {
          setError(error.message === 'Invalid login credentials' 
            ? 'Email o contraseña incorrectos'
            : 'Error al iniciar sesión');
          setLoading(false);
          return;
        }

        // Usuario autenticado exitosamente
        onLogin({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || 'Usuario',
          oposicion: data.user.user_metadata?.oposicion || 'Sin especificar',
          subscription: 'free',
          isGuest: false,
          isFirstLogin: false
        });
        
      } else {
        // REGISTRO con Supabase
        const { data, error } = await authHelpers.signUp(
          formData.email,
          formData.password,
          {
            name: formData.name,
            oposicion: formData.oposicion
          }
        );
        
        if (error) {
          setError(error.message === 'User already registered'
            ? 'Este email ya está registrado'
            : 'Error al crear la cuenta');
          setLoading(false);
          return;
        }

        // Usuario creado (trigger de Supabase crea perfil automáticamente)
        onLogin({
          id: data.user.id,
          email: data.user.email,
          name: formData.name,
          oposicion: formData.oposicion,
          subscription: 'free',
          isGuest: false,
          isFirstLogin: true
        });
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error('Error en auth:', err);
      setError('Error al procesar la solicitud');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            PasaElTest
          </h1>
          <p className="text-gray-400">Tu asistente inteligente de estudio</p>
        </div>

        {/* Formulario */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-all ${
                isLogin 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-all ${
                !isLogin 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Oposición</label>
                  <select
                    required
                    value={formData.oposicion}
                    onChange={(e) => setFormData({...formData, oposicion: e.target.value})}
                    className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Selecciona tu oposición</option>
                    <option value="Guardia Civil">Guardia Civil</option>
                    <option value="Policía Nacional">Policía Nacional</option>
                    <option value="Administración General">Administración General</option>
                    <option value="Justicia">Justicia</option>
                    <option value="Correos">Correos</option>
                    <option value="Hacienda">Hacienda</option>
                    <option value="Educación">Educación</option>
                    <option value="Sanidad">Sanidad</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
              </>
            )}
            
            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder={MVP_MODE ? "cualquier@email.com (o déjalo vacío)" : "tu@email.com"}
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder={MVP_MODE ? "cualquier cosa (o déjalo vacío)" : "••••••••"}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-800 text-gray-400">o</span>
            </div>
          </div>

          {/* Modo Invitado */}
          <button
            onClick={handleGuestMode}
            className="w-full bg-white/5 border border-white/10 text-white py-3 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xl">👤</span>
            <span className="font-semibold">Probar sin registrarme</span>
          </button>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mt-4">
            <p className="text-yellow-400 text-xs text-center">
              ⚠️ <strong>Modo invitado:</strong> Tus datos no se guardarán al cerrar la app
            </p>
          </div>

          <p className="text-gray-500 text-xs text-center mt-6">
            Al continuar, aceptas nuestros Términos y Condiciones
          </p>
        </div>
      </div>
    </div>
  );
}

// Pantalla de Onboarding (primera vez)
function OnboardingScreen({ user, onComplete }) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    numThemes: 90,
    penaltySystem: 'classic',
    notifications: false,
    darkMode: false
  });

  // Si es invitado, configuración por defecto y saltar al final
  useEffect(() => {
    if (user.isGuest) {
      setStep(2); // Ir al último paso
    }
  }, [user.isGuest]);

  const steps = user.isGuest ? [
    {
      title: '¡Bienvenido! 👋',
      description: 'Estás en modo prueba',
      icon: '🎉'
    },
    {
      title: 'Configuración',
      description: 'Setup rápido',
      icon: '📚'
    },
    {
      title: '¡Modo Demo Activado! 🚀',
      description: 'Explora todas las funciones libremente',
      icon: '✨'
    }
  ] : [
    {
      title: '¡Bienvenido a PasaElTest! 👋',
      description: `Hola ${user.name}, vamos a configurar tu espacio de estudio personalizado`,
      icon: '🎉'
    },
    {
      title: 'Configura tu oposición',
      description: 'Cuéntanos más sobre tu proceso de estudio',
      icon: '📚'
    },
    {
      title: '¡Todo listo! 🚀',
      description: 'Comienza a estudiar de forma inteligente',
      icon: '✨'
    }
  ];

  const handleComplete = async () => {
    const profile = {
      name: user.name,
      examName: user.oposicion,
      numThemes: config.numThemes,
      penaltySystem: config.penaltySystem,
      darkMode: config.darkMode,
      notifications: config.notifications
    };

    // Actualizar el usuario para marcar onboarding como completado
    if (!user.isGuest && user.isFirstLogin) {
      const updatedUser = { ...user, isFirstLogin: false };
      // Actualizar en el estado (no necesitamos storage aquí)
      // Supabase ya tiene el usuario registrado
      onComplete(profile, updatedUser);
    } else {
      onComplete(profile);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 flex-1 rounded-full mx-1 transition-all ${
                    idx <= step ? 'bg-blue-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <p className="text-gray-400 text-sm text-center">
              Paso {step + 1} de {steps.length}
            </p>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{steps[step].icon}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{steps[step].title}</h2>
            <p className="text-gray-400">{steps[step].description}</p>
          </div>

          {/* Guest warning */}
          {user.isGuest && step === 2 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
              <p className="text-yellow-400 text-sm text-center mb-3">
                <strong>⚠️ Modo Invitado Activo</strong>
              </p>
              <p className="text-yellow-300 text-xs text-center mb-3">
                Tus datos NO se guardarán al cerrar la app. Para guardar tu progreso, crea una cuenta gratis.
              </p>
              <p className="text-gray-400 text-xs text-center">
                Puedes registrarte en cualquier momento desde Configuración
              </p>
            </div>
          )}

          {/* Step content */}
          {step === 1 && !user.isGuest && (
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Número de temas</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={config.numThemes}
                  onChange={(e) => setConfig({...config, numThemes: parseInt(e.target.value)})}
                  className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10"
                  placeholder="Ej: 90"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-2">Sistema de penalización</label>
                <select
                  value={config.penaltySystem}
                  onChange={(e) => setConfig({...config, penaltySystem: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10"
                >
                  <option value="classic">Clásico (3 incorrectas = -1)</option>
                  <option value="strict">Estricto (2 incorrectas = -1)</option>
                  <option value="permissive">Permisivo (4 incorrectas = -1)</option>
                  <option value="none">Sin penalización</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                <span className="text-gray-300">Modo oscuro</span>
                <button
                  onClick={() => setConfig({...config, darkMode: !config.darkMode})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.darkMode ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.darkMode ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {step > 0 && !user.isGuest && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 bg-white/5 text-white py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                Atrás
              </button>
            )}
            <button
              onClick={() => {
                if (step < steps.length - 1) {
                  setStep(step + 1);
                } else {
                  handleComplete();
                }
              }}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              {step === steps.length - 1 ? '¡Comenzar!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Panel de Usuario mejorado
function UserProfileModal({ user, profile, onClose, onLogout, onUpdateProfile }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    oposicion: user?.oposicion || profile?.examName || ''
  });

  const handleSave = async () => {
    const updatedUser = { ...user, ...formData };
    await storage.set('current-user', updatedUser);
    
    const users = await storage.get('users') || [];
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      await storage.set('users', users);
    }

    const updatedProfile = { ...profile, name: formData.name, examName: formData.oposicion };
    await storage.set('user-profile', updatedProfile);
    
    onUpdateProfile(updatedProfile);
    setEditing(false);
  };

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que quieres cerrar sesión?')) {
      await storage.set('user-session', null);
      onLogout();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold text-xl">Mi Perfil</h2>
          <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors">
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-4xl font-bold text-white mb-3">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              user?.subscription === 'premium' 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {user?.subscription === 'premium' ? '👑 Premium' : 'Free'}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Nombre</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                />
              ) : (
                <p className="text-white font-medium">{user?.name}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1">Email</label>
              <p className="text-white font-medium">{user?.email}</p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1">Oposición</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.oposicion}
                  onChange={(e) => setFormData({...formData, oposicion: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                />
              ) : (
                <p className="text-white font-medium">{user?.oposicion || profile?.examName}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1">Miembro desde</label>
              <p className="text-white font-medium">
                {new Date(user?.createdAt).toLocaleDateString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Guardar Cambios
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="w-full bg-white/5 text-white py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Editar Perfil
              </button>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 text-red-400 border border-red-500/30 font-semibold py-3 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════
const Icons = {
  Home: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Book: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  Exam: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Stats: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Fire: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
  Settings: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  ChevronLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Upload: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  ThumbsDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>,
  CheckSquare: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

function HomeScreen({ onNavigate, stats, profile, user, onShowProfile }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Banner modo invitado */}
        {user?.isGuest && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 rounded-2xl p-4 shadow-xl animate-pulse">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-yellow-300 font-bold text-sm mb-1">Modo Invitado - Datos Temporales</p>
                <p className="text-yellow-200 text-xs mb-3">
                  Tu progreso no se guardará al cerrar. Regístrate gratis para guardar tus temas y exámenes.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('¿Quieres registrarte ahora? Perderás los datos actuales.')) {
                      onNavigate('settings');
                    }
                  }}
                  className="bg-yellow-500 text-slate-900 font-bold text-xs px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  Crear Cuenta Gratis
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative">
          {/* Botón de perfil de usuario */}
          {user && (
            <button 
              onClick={onShowProfile}
              className="absolute top-3 left-3 sm:top-4 sm:left-4 p-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl transition-all shadow-lg"
              title="Mi Perfil"
            >
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold text-sm">
                {user.isGuest ? '👤' : user.name?.charAt(0).toUpperCase()}
              </div>
            </button>
          )}
          
          <button 
            onClick={() => onNavigate('settings')}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <Icons.Settings />
          </button>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">PasaElTest</h1>
          <p className="text-gray-400 text-xs sm:text-sm">Tu asistente inteligente de estudio</p>
          {profile?.examName && profile.examName !== 'Mi Oposición' && (
            <div className="mt-3 inline-block">
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">
                📚 {profile.examName}
              </span>
            </div>
          )}
          {user && (
            <p className="text-gray-500 text-xs mt-2">
              {user.isGuest ? 'Modo Prueba 👤' : `Hola, ${user.name} 👋`}
            </p>
          )}
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-white font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base"><Icons.Stats />Resumen de Progreso</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white/5 rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{stats.totalExams || 0}</div>
              <div className="text-gray-400 text-xs sm:text-sm mt-1">Exámenes</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{stats.totalQuestions || 0}</div>
              <div className="text-gray-400 text-xs sm:text-sm mt-1">Preguntas</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-400">{stats.avgScore || 0}%</div>
              <div className="text-gray-400 text-xs sm:text-sm mt-1">Media</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-400">{stats.themesCompleted || 0}/90</div>
              <div className="text-gray-400 text-xs sm:text-sm mt-1">Temas</div>
            </div>
          </div>
        </div>
        <div className="space-y-2 sm:space-y-3">
          <button onClick={() => onNavigate('exam')} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg text-sm sm:text-base">
            <Icons.Exam />Crear Nuevo Examen
          </button>
          <button onClick={() => onNavigate('heatmap')} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg text-sm sm:text-base">
            <Icons.Fire />Ver Mapa de Calor
          </button>
          <button onClick={() => onNavigate('themes')} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base">
            <Icons.Book />Gestionar Temas
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeDetailModal({ theme, onClose, onUpdate, showToast }) {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docType, setDocType] = useState('url');
  const [docContent, setDocContent] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    options: ['', '', ''],
    correct: 0,
    difficulty: 'media'
  });
  const fileInputRef = useRef(null);
  
  // Estado para auto-generación de repositorio
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  
  // Estado para edición de nombre
  const [editingName, setEditingName] = useState(theme.name);
  const [nameJustSaved, setNameJustSaved] = useState(false);
  
  // Sincronizar editingName cuando theme.name cambia externamente
  useEffect(() => {
    setEditingName(theme.name);
  }, [theme.name]);
  
  // Estado para diálogo de confirmación personalizado
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    docIndex: null,
    docName: ''
  });
  
  // Estado para diálogo de confirmación de preguntas
  const [deleteQuestionsConfirm, setDeleteQuestionsConfirm] = useState({
    show: false,
    type: null, // 'selected' o 'all'
    count: 0
  });

  // Detectar si se debe mostrar auto-generación cuando se guarda el nombre
  useEffect(() => {
    if (DEBUG) console.log('🔍 Checking auto-generate:', {
      nameJustSaved,
      docsLength: theme.documents?.length,
      themeName: theme.name,
      defaultName: `Tema ${theme.number}`,
      shouldShow: nameJustSaved && 
        (!theme.documents || theme.documents.length === 0) && 
        theme.name && 
        theme.name.trim() !== '' &&
        theme.name !== `Tema ${theme.number}`
    });
    
    if (nameJustSaved && 
        (!theme.documents || theme.documents.length === 0) && 
        theme.name && 
        theme.name.trim() !== '' &&
        theme.name !== `Tema ${theme.number}`) {
      if (DEBUG) console.log('✅ Showing auto-generate banner!');
      setShowAutoGenerate(true);
      setNameJustSaved(false); // Reset flag
    }
  }, [nameJustSaved, theme.documents, theme.name, theme.number]);

  // Manejar guardado de nombre
  const handleSaveName = () => {
    const trimmedName = editingName.trim();
    if (DEBUG) console.log('💾 Saving name:', { trimmedName, oldName: theme.name });
    
    if (trimmedName && trimmedName !== theme.name) {
      onUpdate({...theme, name: trimmedName});
      // Delay para asegurar que el tema se actualiza antes del check
      setTimeout(() => {
        if (DEBUG) console.log('🚀 Setting nameJustSaved = true');
        setNameJustSaved(true);
      }, 150);
    }
  };

  // Guardar nombre al presionar Enter
  const handleNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    }
  };

  // Función para auto-generar repositorio basado en el nombre del tema
  const handleAutoGenerateRepository = async () => {
    setIsAutoGenerating(true);
    setShowAutoGenerate(false);
    
    const searchQuery = `${theme.name} oposición España temario completo`;
    
    if (showToast) showToast(`Generando repositorio para "${theme.name}"...`, 'info');
    
    try {
      setIsSearching(true);
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          tools: [{
            type: "web_search_20250305",
            name: "web_search"
          }],
          messages: [{
            role: "user",
            content: `Busca información completa y oficial sobre: "${theme.name}" para preparar una oposición en España.

INSTRUCCIONES:
1. Busca fuentes oficiales (BOE, leyes, temarios oficiales)
2. Enfócate en contenido relevante para oposiciones
3. Prioriza documentos con artículos, procedimientos y normativa
4. Resume los puntos clave de forma estructurada

Busca: ${searchQuery}`
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Error en la búsqueda');
      }

      const data = await response.json();
      
      // Procesar respuesta y extraer contenido
      let searchContent = '';
      let toolResults = [];
      
      for (const block of data.content) {
        if (block.type === 'text') {
          searchContent += block.text + '\n';
        } else if (block.type === 'tool_use') {
          toolResults.push(block);
        }
      }

      // Crear documento con los resultados
      const newDoc = {
        type: 'ai-search',
        content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: {
          query: searchQuery,
          content: searchContent,
          processedContent: searchContent
        },
        processedContent: searchContent
      };

      // Añadir al tema
      const updatedTheme = {
        ...theme,
        documents: [...(theme.documents || []), newDoc]
      };
      
      onUpdate(updatedTheme);
      
      if (showToast) showToast(`✅ Repositorio generado para "${theme.name}"`, 'success');
      
    } catch (error) {
      console.error('Error generando repositorio:', error);
      if (showToast) showToast('Error al generar repositorio automático', 'error');
    } finally {
      setIsSearching(false);
      setIsAutoGenerating(false);
    }
  };

  const generateQuestionsFromDocuments = async () => {
    if (!theme.documents || theme.documents.length === 0) {
      if (showToast) showToast('Primero añade documentos a este tema para generar preguntas', 'warning');
      return;
    }

    setIsGeneratingQuestions(true);
    setGenerationProgress('📚 Recopilando contenido de documentos...');
    setGenerationPercent(5);

    try {
      // Recopilar contenido - usar contenido procesado/optimizado cuando esté disponible
      let documentContents = '';
      let charCount = 0;
      const maxChars = 100000; // Aumentado significativamente para manejar documentos largos (leyes completas, temarios extensos)
      
      setGenerationProgress('📖 Procesando repositorio completo...');
      setGenerationPercent(10);
      
      for (const doc of theme.documents) {
        if (charCount >= maxChars) break;
        
        let docText = '';
        
        // Priorizar contenido procesado (optimizado para preguntas)
        if (doc.processedContent) {
          docText = `\n═══ FUENTE OPTIMIZADA ═══\n${doc.fileName || doc.content.substring(0, 100)}\n\n${doc.processedContent}\n`;
        } else if (doc.searchResults?.processedContent) {
          docText = `\n═══ BÚSQUEDA IA OPTIMIZADA ═══\n${doc.content}\n\n${doc.searchResults.processedContent}\n`;
        } else if (doc.searchResults?.content) {
          docText = `\n═══ BÚSQUEDA WEB ═══\n${doc.content}\n\n${doc.searchResults.content}\n`;
        } else if (doc.content) {
          docText = `\n═══ DOCUMENTO ═══\n${doc.fileName || 'Texto pegado'}\n\n${doc.content}\n`;
        }
        
        const remaining = maxChars - charCount;
        documentContents += docText.substring(0, remaining);
        charCount += docText.length;
      }

      if (documentContents.trim().length < 100) {
        throw new Error('No hay suficiente contenido. Añade documentos o usa búsqueda IA.');
      }

      console.log(`📊 Contenido recopilado: ${charCount.toLocaleString()} caracteres de ${theme.documents.length} documentos`);

      setGenerationProgress('🤖 Enviando a IA para generar preguntas...');
      setGenerationPercent(20);

      // Obtener preguntas existentes
      const existingQuestions = (theme.questions || []).map(q => q.text.substring(0, 80)).join('\n');

      // OPTIMIZADO: 25 preguntas en lugar de 50 para velocidad 2x
      const numToGenerate = 25;
      
      setGenerationProgress(`🤖 Generando ${numToGenerate} preguntas...`);
      setGenerationPercent(30);
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          messages: [{
            role: "user",
            content: `Eres un experto creador de preguntas tipo test para oposiciones sobre "${theme.name}".

Tu objetivo: Crear ${numToGenerate} preguntas de máxima calidad, precisión y utilidad.

═══════════════════════════════════════════════════════════════════════
📚 CONTENIDO FUENTE (USA SOLO ESTA INFORMACIÓN):
${documentContents.substring(0, 35000)}
═══════════════════════════════════════════════════════════════════════

${existingQuestions.length > 0 ? `
🚫 PREGUNTAS YA EXISTENTES - NO REPETIR NI REFORMULAR:
${existingQuestions}

⚠️ OBLIGATORIO: Cubre aspectos COMPLETAMENTE DIFERENTES del contenido.
` : ''}

═══════════════════════════════════════════════════════════════════════
🎯 CRITERIOS DE CALIDAD OBLIGATORIOS:
═══════════════════════════════════════════════════════════════════════

1. PRECISIÓN ABSOLUTA:
   ✓ Solo datos EXACTOS del contenido proporcionado
   ✓ Cita artículos/números/fechas LITERALMENTE como aparecen
   ✓ NUNCA inventes, supongas o aproximes información
   ✓ Si no estás 100% seguro de un dato, NO crees pregunta sobre eso

2. INFORMACIÓN VERIFICABLE:
   ✓ Cada pregunta debe tener respuesta clara en el contenido
   ✓ Números, fechas, porcentajes: EXACTOS del texto fuente
   ✓ Nombres propios: escritura exacta del documento
   ✓ Artículos de ley: numeración precisa

3. OPCIONES PLAUSIBLES:
   ✓ Opciones incorrectas deben ser realistas (no absurdas)
   ✓ Usa datos reales del contenido para opciones falsas
   ✓ Diferencias sutiles entre opciones (típico de oposiciones)
   ✓ Longitud similar en todas las opciones

4. TIPOS DE PREGUNTAS EFECTIVAS:
   ✓ Conceptos clave y definiciones técnicas
   ✓ Artículos específicos y su contenido exacto
   ✓ Diferencias entre conceptos similares
   ✓ Plazos, procedimientos, requisitos
   ✓ Excepciones y casos especiales
   ✓ Fechas de vigencia, modificaciones

5. EVITAR:
   ✗ Preguntas triviales o demasiado genéricas
   ✗ Datos que no aparecen en el contenido
   ✗ Interpretaciones o deducciones tuyas
   ✗ Negaciones dobles ("no es incorrecto que...")
   ✗ Opciones obviamente falsas

═══════════════════════════════════════════════════════════════════════
📝 FORMATO DE RESPUESTA (JSON PURO - SIN TEXTO ADICIONAL):
═══════════════════════════════════════════════════════════════════════

[
  {
    "pregunta": "Según el artículo X de [ley], ¿cuál es...?",
    "opciones": [
      "Opción A con datos específicos",
      "Opción B con datos específicos", 
      "Opción C con datos específicos"
    ],
    "correcta": 0,
    "dificultad": "media"
  }
]

DIFICULTADES:
- "fácil": Definiciones básicas, conceptos directos
- "media": Aplicación de conceptos, artículos específicos
- "difícil": Casos complejos, diferencias sutiles, excepciones

DISTRIBUCIÓN: 30% fácil, 50% media, 20% difícil

═══════════════════════════════════════════════════════════════════════
✅ CHECKLIST ANTES DE RESPONDER:
═══════════════════════════════════════════════════════════════════════

□ Todas las preguntas tienen respuesta VERIFICABLE en el contenido
□ Todos los datos (números, fechas, nombres) son EXACTOS
□ Opciones incorrectas son PLAUSIBLES, no absurdas
□ CERO inventos o suposiciones
□ Cada pregunta aporta valor educativo
□ JSON válido sin texto adicional
□ EXACTAMENTE ${numToGenerate} preguntas

Responde SOLO con el JSON de las preguntas.`
          }]
        })
      });

      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(60);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error API (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(70);

      let textContent = '';
      for (const block of data.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }

      if (!textContent) {
        throw new Error('La IA no devolvió contenido');
      }

      // Extraer JSON
      setGenerationProgress('🔍 Extrayendo preguntas...');
      setGenerationPercent(80);
      
      let cleanedResponse = textContent.trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^[^[]*/, '') // Quitar texto antes del [
        .replace(/[^\]]*$/, ''); // Quitar texto después del ]
      
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Respuesta:', textContent.substring(0, 500));
        throw new Error('No se pudo extraer JSON. La IA respondió con texto no estructurado.');
      }

      setGenerationProgress('✓ Validando formato...');
      setGenerationPercent(90);

      let generatedQuestions;
      try {
        generatedQuestions = JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error('JSON inválido: ' + e.message);
      }

      if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
        throw new Error('La IA no generó preguntas válidas');
      }

      setGenerationProgress('💾 Validando y guardando...');
      setGenerationPercent(95);

      // Convertir preguntas generadas
      const newQuestionsRaw = generatedQuestions.map((q, i) => ({
        id: `${theme.number}-ai-${Date.now()}-${i}`,
        text: q.pregunta || q.text || 'Pregunta sin texto',
        options: q.opciones || q.options || ['A', 'B', 'C'],
        correct: q.correcta ?? q.correct ?? 0,
        source: 'IA',
        difficulty: q.dificultad || q.difficulty || 'media',
        explanation: q.explicacion || q.explanation || '',
        needsReview: true,
        createdAt: new Date().toISOString()
      }));

      // FILTRAR DUPLICADOS: comparar con preguntas existentes
      const existingTexts = (theme.questions || []).map(q => 
        q.text.toLowerCase().trim()
      );
      
      const newQuestions = newQuestionsRaw.filter(newQ => {
        const newText = newQ.text.toLowerCase().trim();
        
        // Verificar si es duplicado exacto
        if (existingTexts.includes(newText)) {
          console.log('❌ Duplicado exacto detectado:', newQ.text.substring(0, 50));
          return false;
        }
        
        // Verificar si es muy similar (>80% igual)
        const isTooSimilar = existingTexts.some(existingText => {
          const similarity = calculateSimilarity(newText, existingText);
          if (similarity > 0.8) {
            console.log('❌ Duplicado similar detectado:', newQ.text.substring(0, 50), `(${(similarity * 100).toFixed(0)}% similar)`);
            return true;
          }
          return false;
        });
        
        return !isTooSimilar;
      });
      
      // Función auxiliar para calcular similitud
      function calculateSimilarity(str1, str2) {
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w));
        return commonWords.length / Math.max(words1.length, words2.length);
      }

      if (newQuestions.length === 0) {
        throw new Error('Todas las preguntas generadas eran duplicadas. Intenta de nuevo.');
      }

      const updatedTheme = {
        ...theme,
        questions: [...(theme.questions || []), ...newQuestions],
        lastGenerated: new Date().toISOString()
      };

      onUpdate(updatedTheme);

      const duplicatesFound = newQuestionsRaw.length - newQuestions.length;
      const message = duplicatesFound > 0 
        ? `✅ ${newQuestions.length} preguntas nuevas (${duplicatesFound} duplicadas filtradas)`
        : `✅ ¡${newQuestions.length} preguntas generadas!`;
      
      setGenerationProgress(message);
      setGenerationPercent(100);

      setTimeout(() => {
        setIsGeneratingQuestions(false);
        setGenerationProgress('');
        setGenerationPercent(0);
      }, 2000);

    } catch (error) {
      console.error('Error completo:', error);
      setIsGeneratingQuestions(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) {
        errorMsg = 'Error de conexión. Verifica tu internet.';
      } else if (errorMsg.includes('JSON')) {
        errorMsg = 'Error procesando respuesta. Intenta con menos contenido.';
      }
      
      alert(`❌ Error: ${errorMsg}\n\nSugerencias:\n- Usa "Buscar con IA" en lugar de subir PDF\n- Asegúrate de que los documentos tengan contenido de texto\n- Intenta con documentos más pequeños`);
    }
  };

  const handleAISearch = async () => {
    if (!docContent.trim()) {
      if (showToast) showToast('Describe qué información buscar', 'warning');
      return;
    }
    
    setIsSearching(true);
    setGenerationProgress('🔍 Buscando y procesando con IA...');
    setGenerationPercent(10);
    
    try {
      // UNA SOLA LLAMADA - Buscar Y procesar en un solo paso
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000, // Más tokens para obtener todo en una llamada
          tools: [{
            type: "web_search_20250305",
            name: "web_search"
          }],
          messages: [{
            role: "user",
            content: `Busca información sobre: "${docContent}" para el tema de oposiciones "${theme.name}".

Después de buscar, crea un REPOSITORIO ESTRUCTURADO para generar preguntas de examen.

ESTRUCTURA REQUERIDA:

# ${theme.name}

## CONCEPTOS CLAVE
[Definiciones precisas, terminología técnica]

## NORMATIVA Y LEGISLACIÓN
[Leyes, artículos, fechas, vigencias]

## DATOS IMPORTANTES
[Cifras exactas, porcentajes, plazos, umbrales]

## PROCEDIMIENTOS
[Pasos secuenciales, requisitos, excepciones]

## CASOS PRÁCTICOS
[Ejemplos de aplicación real]

## PUNTOS CRÍTICOS DE EXAMEN
[Aspectos frecuentes en tests, diferencias sutiles, confusiones comunes]

Proporciona un documento COMPLETO (mínimo 1500 palabras) con máximo detalle y precisión.`
          }]
        })
      });

      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(70);

      if (!response.ok) {
        throw new Error(`Error API: ${response.status}`);
      }

      const data = await response.json();
      
      let processedContent = '';
      for (const block of data.content) {
        if (block.type === 'text') {
          processedContent += block.text;
        }
      }

      if (!processedContent.trim() || processedContent.length < 500) {
        throw new Error('No se encontró suficiente información');
      }

      setGenerationProgress('💾 Guardando...');
      setGenerationPercent(90);

      const newDoc = {
        type: 'ai-search',
        content: docContent,
        processedContent: processedContent,
        quality: 'optimized',
        wordCount: processedContent.split(' ').length,
        addedAt: new Date().toISOString()
      };
      
      const updatedTheme = { 
        ...theme, 
        documents: [...(theme.documents || []), newDoc] 
      };
      
      onUpdate(updatedTheme);
      
      setGenerationProgress('✅ ¡Completado!');
      setGenerationPercent(100);
      
      setTimeout(() => {
        setDocContent('');
        setShowAddDoc(false);
        setIsSearching(false);
        setGenerationProgress('');
        setGenerationPercent(0);
      }, 1500);

    } catch (error) {
      console.error('Error en búsqueda IA:', error);
      setIsSearching(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) {
        errorMsg = 'Error de conexión. Verifica tu internet.';
      } else if (errorMsg.includes('JSON')) {
        errorMsg = 'Error procesando respuesta. Intenta de nuevo.';
      }
      
      alert(`❌ Error: ${errorMsg}`);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsSearching(true);
    setGenerationProgress('📄 Leyendo archivo...');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const textContent = content.substring(0, 50000);
        
        if (textContent.trim().length < 100) {
          throw new Error('El archivo tiene muy poco contenido de texto');
        }
        
        // OPTIMIZADO: Guardar directamente sin procesamiento extra
        // El contenido ya está extraído, la IA lo procesará cuando genere preguntas
        setGenerationProgress('💾 Guardando documento...');
        
        const newDoc = {
          type: 'pdf',
          fileName: file.name,
          content: textContent.substring(0, 35000), // Limitar a ~35k caracteres
          processedContent: textContent.substring(0, 35000),
          addedAt: new Date().toISOString()
        };
        
        const updatedTheme = {
          ...theme,
          documents: [...(theme.documents || []), newDoc]
        };
        
        onUpdate(updatedTheme);
        
        setGenerationProgress('✅ ¡Archivo guardado!');
        
        setTimeout(() => {
          setIsSearching(false);
          setGenerationProgress('');
          setShowAddDoc(false);
        }, 1500);
        
      } catch (error) {
        setIsSearching(false);
        setGenerationProgress('');
        alert(`Error: ${error.message}\n\nSugerencia: Usa "Buscar con IA" para mejores resultados.`);
      }
    };
    
    reader.onerror = () => {
      setIsSearching(false);
      setGenerationProgress('');
      alert('Error al leer el archivo.');
    };
    
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAddDocument = async () => {
    if (docType === 'ai-search') {
      handleAISearch();
      return;
    }
    
    if (!docContent.trim()) {
      alert('Introduce una URL o contenido');
      return;
    }
    
    // Si es URL, usar web_fetch para obtener contenido
    if (docType === 'url') {
      // Validar que sea una URL válida
      try {
        new URL(docContent);
      } catch (e) {
        alert('❌ URL inválida. Debe empezar con http:// o https://');
        return;
      }
      
      setIsSearching(true);
      setGenerationProgress('🌐 Obteniendo contenido de la web...');
      setGenerationPercent(20);
      
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8000,
            messages: [{
              role: "user",
              content: `Obtén el contenido de esta URL y estructúralo para el tema "${theme.name}":

URL: ${docContent}

Extrae y estructura la información relevante:

# ${theme.name}

## CONTENIDO PRINCIPAL
[Conceptos, definiciones, puntos clave]

## DETALLES IMPORTANTES
[Datos, cifras, procedimientos]

## INFORMACIÓN COMPLEMENTARIA
[Casos prácticos, ejemplos]

Proporciona un documento completo con TODA la información del enlace.`
            }]
          })
        });

        setGenerationProgress('📝 Procesando contenido...');
        setGenerationPercent(60);

        if (!response.ok) {
          throw new Error(`Error API: ${response.status}`);
        }

        const data = await response.json();
        
        let processedContent = '';
        for (const block of data.content) {
          if (block.type === 'text') {
            processedContent += block.text;
          }
        }

        if (!processedContent.trim() || processedContent.length < 200) {
          throw new Error('No se pudo obtener suficiente contenido de la URL. La página podría estar protegida o vacía.');
        }

        setGenerationProgress('💾 Guardando documento...');
        setGenerationPercent(90);

        const newDoc = {
          type: 'url',
          content: docContent,
          processedContent: processedContent,
          wordCount: processedContent.split(' ').length,
          addedAt: new Date().toISOString()
        };
        
        const updatedTheme = {
          ...theme,
          documents: [...(theme.documents || []), newDoc]
        };
        
        onUpdate(updatedTheme);
        
        setGenerationProgress('✅ ¡URL guardada!');
        setGenerationPercent(100);
        
        setTimeout(() => {
          setDocContent('');
          setShowAddDoc(false);
          setIsSearching(false);
          setGenerationProgress('');
          setGenerationPercent(0);
        }, 1500);

      } catch (error) {
        console.error('Error obteniendo URL:', error);
        setIsSearching(false);
        setGenerationProgress('');
        setGenerationPercent(0);
        
        let errorMsg = error.message;
        if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
          errorMsg = 'Error de conexión. Verifica tu internet.';
        }
        
        alert(`❌ No se pudo procesar la URL\n\n${errorMsg}\n\n💡 Alternativas:\n• Usa "Buscar con IA" y describe el contenido\n• Copia y pega el texto en un archivo TXT\n• Verifica que la URL sea accesible públicamente`);
      }
    } else {
      // Guardar como texto simple
      const newDoc = {
        type: 'text',
        content: docContent,
        processedContent: docContent,
        addedAt: new Date().toISOString()
      };
      
      onUpdate({ 
        ...theme, 
        documents: [...(theme.documents || []), newDoc] 
      });
      
      setDocContent('');
      setShowAddDoc(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedQuestions.size === 0) {
      alert('Selecciona al menos una pregunta');
      return;
    }
    
    setDeleteQuestionsConfirm({
      show: true,
      type: 'selected',
      count: selectedQuestions.size
    });
  };

  const handleDeleteAll = () => {
    setDeleteQuestionsConfirm({
      show: true,
      type: 'all',
      count: theme.questions?.length || 0
    });
  };
  
  const confirmDeleteQuestions = () => {
    if (deleteQuestionsConfirm.type === 'selected') {
      const newQuestions = theme.questions.filter(q => !selectedQuestions.has(q.id));
      onUpdate({
        ...theme,
        questions: newQuestions
      });
      setSelectedQuestions(new Set());
      setSelectMode(false);
    } else if (deleteQuestionsConfirm.type === 'all') {
      onUpdate({ ...theme, questions: [] });
      setSelectedQuestions(new Set());
      setSelectMode(false);
    }
    setDeleteQuestionsConfirm({ show: false, type: null, count: 0 });
  };

  const toggleSelectQuestion = (id) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuestions(newSelected);
  };

  const handleManualQuestionAdd = () => {
    if (!newQuestion.text.trim() || newQuestion.options.some(opt => !opt.trim())) {
      alert('Completa todos los campos');
      return;
    }

    const question = {
      id: `${theme.number}-manual-${Date.now()}`,
      ...newQuestion,
      source: 'Manual',
      needsReview: false,
      createdAt: new Date().toISOString()
    };

    onUpdate({
      ...theme,
      questions: [...(theme.questions || []), question]
    });

    setNewQuestion({
      text: '',
      options: ['', '', ''],
      correct: 0,
      difficulty: 'media'
    });
    setShowAddQuestion(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-3xl h-[90vh] flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* HEADER FIJO */}
        <div className="flex-shrink-0 bg-slate-800 p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white font-bold text-lg sm:text-xl">Tema {theme.number}</h2>
                {theme.name === `Tema ${theme.number}` && (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
                    Sin personalizar
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyPress={handleNameKeyPress}
                  onBlur={handleSaveName}
                  className="flex-1 bg-white/5 text-gray-300 text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Ej: Constitución Española, Derecho Administrativo..."
                />
                {editingName !== theme.name && (
                  <button
                    onClick={handleSaveName}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center gap-1"
                  >
                    <Icons.Check />
                    Guardar
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                💡 Escribe un nombre y presiona Enter o click fuera para guardar
              </p>
            </div>
            <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors flex-shrink-0">
              <Icons.X />
            </button>
          </div>
        </div>
        
        {/* CONTENIDO SCROLLEABLE */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ 
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(90vh - 140px)'
          }}
        >
          <div className="p-4 sm:p-6 space-y-6">
          {/* Contenido del modal */}
          {/* DOCUMENTOS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">Repositorio de Conocimiento</h3>
                <p className="text-gray-500 text-xs mt-1">
                  {theme.documents?.length > 0 
                    ? `${theme.documents.length} documento${theme.documents.length > 1 ? 's' : ''} optimizado${theme.documents.length > 1 ? 's' : ''}`
                    : 'Añade contenido estructurado para generar preguntas'}
                </p>
              </div>
              <button onClick={() => setShowAddDoc(!showAddDoc)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-600 transition-colors">
                <Icons.Plus />Añadir
              </button>
            </div>

            {/* Sugerencia de auto-generación */}
            {showAutoGenerate && !isAutoGenerating && theme.documents?.length === 0 && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-xl p-4 mb-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🤖</span>
                  <div className="flex-1">
                    <p className="text-green-300 font-bold text-sm mb-1">
                      ✨ Generación Automática Disponible
                    </p>
                    <p className="text-green-200 text-xs mb-3">
                      Detectamos que este tema se llama <strong>"{theme.name}"</strong>. 
                      ¿Quieres que busquemos y generemos un repositorio automático con contenido oficial?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAutoGenerateRepository}
                        disabled={isAutoGenerating}
                        className="bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2"
                      >
                        <span>🚀</span> Generar Repositorio Automático
                      </button>
                      <button
                        onClick={() => setShowAutoGenerate(false)}
                        className="bg-white/10 text-gray-300 text-xs px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading auto-generación */}
            {isAutoGenerating && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="flex-1">
                    <p className="text-blue-300 font-semibold text-sm">
                      Generando repositorio automático...
                    </p>
                    <p className="text-blue-200 text-xs mt-1">
                      Buscando información oficial sobre "{theme.name}"
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {showAddDoc && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10">
                  <option value="ai-search">🤖 Buscar con IA (Recomendado)</option>
                  <option value="text">📝 Pegar Texto Directamente</option>
                  <option value="url">🔗 Enlace Web</option>
                  <option value="pdf">📄 Subir Archivo (PDF/TXT)</option>
                </select>

                {(isSearching || isGeneratingQuestions) && generationProgress && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-blue-400 text-sm font-medium">{generationProgress}</p>
                      <span className="text-blue-300 text-sm font-bold">{generationPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${generationPercent}%` }}
                      ></div>
                    </div>
                    {generationPercent < 100 && (
                      <p className="text-gray-400 text-xs text-center">
                        Esto puede tardar 15-30 segundos...
                      </p>
                    )}
                  </div>
                )}

                {docType === 'pdf' ? (
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                    <input 
                      type="file" 
                      accept=".pdf,.txt,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="fileUpload"
                    />
                    <label htmlFor="fileUpload" className="cursor-pointer">
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-gray-300 text-sm">Click para subir archivo</p>
                    </label>
                  </div>
                ) : docType === 'ai-search' ? (
                  <div className="space-y-3">
                    <textarea 
                      placeholder="Ej: Busca la Ley 39/2015 del Procedimiento Administrativo Común completa"
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-white/5 text-white rounded-lg px-3 py-3 border border-white/10 min-h-24 resize-none"
                      rows={3}
                    />
                    <button 
                      onClick={handleAISearch}
                      disabled={isSearching || !docContent.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:from-purple-600 hover:to-blue-600 transition-all"
                    >
                      {isSearching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Buscando...
                        </>
                      ) : '🔍 Buscar REAL con IA'}
                    </button>
                  </div>
                ) : docType === 'text' ? (
                  <div className="space-y-3">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2">
                      <p className="text-blue-400 text-xs">💡 Pega aquí el contenido completo de tu documento</p>
                      <p className="text-blue-300 text-xs mt-1">✓ Sin límite de caracteres • Acepta textos muy largos • Leyes completas, temarios extensos, etc.</p>
                    </div>
                    <textarea
                      placeholder="Pega aquí el texto completo del temario, ley, artículos, apuntes, documentos largos..."
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-white/5 text-white rounded-lg px-3 py-3 border border-white/10 min-h-[400px] resize-vertical"
                      rows={20}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-gray-400 text-xs">
                        {docContent.trim().split(' ').length.toLocaleString()} palabras • {docContent.length.toLocaleString()} caracteres
                      </p>
                      <button 
                        onClick={handleAddDocument}
                        disabled={!docContent.trim()}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 hover:from-green-600 hover:to-emerald-700 transition-all"
                      >
                        💾 Guardar Texto
                      </button>
                    </div>
                  </div>
                ) : docType === 'url' ? (
                  <div className="space-y-3">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
                      <p className="text-yellow-400 text-xs">⚠️ Si la URL no funciona, usa "Pegar Texto" o "Buscar con IA"</p>
                    </div>
                    <input 
                      type="url" 
                      placeholder="https://ejemplo.com/documento.pdf o https://boe.es/..."
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                      disabled={isSearching}
                    />
                    <button 
                      onClick={handleAddDocument}
                      disabled={isSearching || !docContent.trim()}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50 hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isSearching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Procesando...
                        </>
                      ) : '🔗 Obtener Contenido de URL'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}            
            <div className="space-y-2">
              {theme.documents?.length > 0 ? (
                theme.documents.map((doc, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            doc.type === 'ai-search' ? 'bg-purple-500/20 text-purple-400' :
                            doc.type === 'pdf' ? 'bg-red-500/20 text-red-400' :
                            doc.type === 'txt' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {doc.type === 'ai-search' ? '🤖 IA' : 
                             doc.type === 'pdf' ? '📄 PDF' : 
                             doc.type === 'txt' ? '📝 TXT' : '🔗 Web'}
                          </span>
                          {doc.quality === 'optimized' && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                              ✓ Optimizado
                            </span>
                          )}
                          {doc.wordCount && (
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-300 rounded text-xs">
                              {doc.wordCount.toLocaleString()} palabras
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm break-words font-medium">
                          {doc.fileName || doc.content.substring(0, 80)}
                          {!doc.fileName && doc.content.length > 80 && '...'}
                        </p>
                        {doc.searchResults?.summary && (
                          <p className="text-gray-500 text-xs mt-1">{doc.searchResults.summary}</p>
                        )}
                        {doc.size && (
                          <p className="text-gray-600 text-xs mt-1">Tamaño: {doc.size}</p>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          
                          console.log('Click en borrar - mostrando diálogo personalizado');
                          const docName = doc.fileName || (doc.type === 'ai-search' ? 'Búsqueda IA' : doc.type === 'url' ? 'Documento web' : 'Documento');
                          
                          setDeleteConfirm({
                            show: true,
                            docIndex: idx,
                            docName: docName
                          });
                        }}
                        className="ml-2 p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-all flex-shrink-0 active:scale-95"
                        title="Eliminar documento"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white/5 rounded-xl border border-dashed border-white/10">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="text-gray-400 font-medium">No hay documentos en el repositorio</p>
                  <p className="text-gray-600 text-sm mt-1">Añade documentos o usa búsqueda IA para comenzar</p>
                </div>
              )}
            </div>
          </div>

          {/* BANCO DE PREGUNTAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Preguntas ({theme.questions?.length || 0})</h3>
              <div className="flex gap-2">
                {theme.questions?.length > 0 && (
                  <>
                    <button 
                      onClick={() => setSelectMode(!selectMode)}
                      className="bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                    >
                      {selectMode ? 'Cancelar' : 'Seleccionar'}
                    </button>
                    {selectMode && (
                      <>
                        <button 
                          onClick={handleDeleteSelected}
                          disabled={selectedQuestions.size === 0}
                          className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          Borrar ({selectedQuestions.size})
                        </button>
                        <button 
                          onClick={handleDeleteAll}
                          className="bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                        >
                          Borrar Todo
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={generateQuestionsFromDocuments}
                  disabled={isGeneratingQuestions || !theme.documents?.length}
                  className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingQuestions ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {generationPercent}%
                    </>
                  ) : '⚡ Generar 25 Preguntas con IA'}
                </button>
                
                <button 
                  onClick={() => setShowAddQuestion(!showAddQuestion)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  <Icons.Plus /> Manual
                </button>
              </div>

              {isGeneratingQuestions && (
                <div className="mt-3 space-y-2">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-blue-400 text-sm">{generationProgress}</p>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${generationPercent}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {showAddQuestion && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                <h4 className="text-white font-semibold text-sm">Nueva Pregunta</h4>
                <textarea 
                  placeholder="Pregunta..."
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10 min-h-20 resize-none"
                />
                {newQuestion.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input 
                      type="radio"
                      checked={newQuestion.correct === i}
                      onChange={() => setNewQuestion({...newQuestion, correct: i})}
                      className="w-4 h-4 mt-1"
                    />
                    <input 
                      placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...newQuestion.options];
                        opts[i] = e.target.value;
                        setNewQuestion({...newQuestion, options: opts});
                      }}
                      className="flex-1 bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                    />
                  </div>
                ))}
                <select 
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion({...newQuestion, difficulty: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                >
                  <option value="fácil">Fácil</option>
                  <option value="media">Media</option>
                  <option value="difícil">Difícil</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={handleManualQuestionAdd} className="flex-1 bg-green-500 text-white font-semibold py-2 rounded-lg">
                    Guardar
                  </button>
                  <button onClick={() => setShowAddQuestion(false)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {/* Lista de preguntas - sin scroll interno, usa el del modal */}
              {theme.questions?.map((q, idx) => (
                <div key={q.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <button
                        onClick={() => toggleSelectQuestion(q.id)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedQuestions.has(q.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                        }`}
                      >
                        {selectedQuestions.has(q.id) && <Icons.Check />}
                      </button>
                    )}
                    <div className="flex-1">
                      <div className="flex gap-2 mb-1">
                        <span className="text-xs text-gray-500">Q{idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          q.difficulty === 'fácil' ? 'bg-green-500/20 text-green-400' :
                          q.difficulty === 'media' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {q.difficulty}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{q.text}</p>
                      <div className="space-y-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-xs px-2 py-1 rounded ${
                            i === q.correct ? 'bg-green-500/10 text-green-400' : 'text-gray-500'
                          }`}>
                            {i === q.correct ? '✓ ' : '○ '}{opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
          {/* Fin contenido scrolleable */}
        </div>
        {/* Fin contenedor scroll */}
      </div>
      {/* Fin modal */}
      
      {/* Diálogo de confirmación para documentos */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteConfirm({show: false, docIndex: null, docName: ''})}>
          <div className="bg-slate-800 border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-xl mb-3">⚠️ Confirmar Eliminación</h3>
            <p className="text-gray-300 mb-2">¿Estás seguro de que quieres eliminar este documento?</p>
            <p className="text-blue-400 font-semibold mb-4">📄 {deleteConfirm.docName}</p>
            <p className="text-red-400 text-sm mb-6">Esta acción NO se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (DEBUG) console.log('Confirmando eliminación...');
                  const newDocs = theme.documents.filter((_, i) => i !== deleteConfirm.docIndex);
                  const updatedTheme = {...theme, documents: newDocs};
                  if (DEBUG) console.log('Docs antes:', theme.documents.length, 'después:', newDocs.length);
                  onUpdate(updatedTheme);
                  setDeleteConfirm({show: false, docIndex: null, docName: ''});
                  if (showToast) showToast('Documento eliminado correctamente', 'success');
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🗑️ SÍ, ELIMINAR
              </button>
              <button
                onClick={() => setDeleteConfirm({show: false, docIndex: null, docName: ''})}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Diálogo de confirmación para preguntas */}
      {deleteQuestionsConfirm.show && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteQuestionsConfirm({show: false, type: null, count: 0})}>
          <div className="bg-slate-800 border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-xl mb-3">⚠️ Confirmar Eliminación</h3>
            <p className="text-gray-300 mb-2">
              {deleteQuestionsConfirm.type === 'all' 
                ? '¿Estás seguro de que quieres eliminar TODAS las preguntas?' 
                : `¿Estás seguro de que quieres eliminar ${deleteQuestionsConfirm.count} preguntas?`}
            </p>
            <p className="text-red-400 text-sm mb-6">Esta acción NO se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteQuestions}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🗑️ SÍ, ELIMINAR
              </button>
              <button
                onClick={() => setDeleteQuestionsConfirm({show: false, type: null, count: 0})}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemesScreen({ themes, onUpdateTheme, onNavigate, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  // Wrapper para actualizar tanto el tema global como el selectedTheme
  const handleUpdateTheme = (updatedTheme) => {
    console.log('🔄 handleUpdateTheme llamado');
    console.log('📁 Tema actualizado:', updatedTheme);
    console.log('📁 Tema seleccionado actual:', selectedTheme);
    
    onUpdateTheme(updatedTheme);
    console.log('✅ onUpdateTheme llamado');
    
    // Cerrar modal temporalmente para forzar refresh
    const wasOpen = selectedTheme !== null;
    if (wasOpen && selectedTheme.number === updatedTheme.number) {
      console.log('🔄 Cerrando y reabriendo modal...');
      setSelectedTheme(null);
      // Reabrir con datos actualizados
      setTimeout(() => {
        console.log('🔄 Reabriendo modal con datos frescos');
        setSelectedTheme(updatedTheme);
      }, 50);
    }
  };

  const filteredThemes = themes.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.number.toString().includes(searchTerm)
  );

  const handleBulkImport = () => {
    const lines = bulkText.trim().split('\n');
    const updates = [];
    
    lines.forEach(line => {
      // Soporta formatos:
      // "1. Nombre del tema"
      // "Tema 1: Nombre del tema"
      // "1,Nombre del tema"
      // "1|Nombre del tema"
      const match = line.match(/(?:Tema\s*)?(\d+)[\s.:,|]+(.+)/i);
      if (match) {
        const number = parseInt(match[1]);
        const name = match[2].trim();
        const theme = themes.find(t => t.number === number);
        if (theme) {
          updates.push({ ...theme, name });
        }
      }
    });
    
    // Aplicar todos los cambios
    updates.forEach(theme => onUpdateTheme(theme));
    setShowBulkImport(false);
    setBulkText('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 bg-white/5 rounded-xl">
            <Icons.ChevronLeft />
          </button>
          <h1 className="text-white font-bold text-2xl flex-1">Temas</h1>
          <button 
            onClick={() => setShowBulkImport(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Icons.Plus />
            Importar Nombres
          </button>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-white/5 text-white rounded-xl px-4 py-3 pl-12 border border-white/10" 
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons.Search />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          {filteredThemes.map(theme => {
            const questionCount = theme.questions?.length || 0;
            // Progreso basado en hitos: 0-25 (naranja), 25-50 (amarillo), 50+ (verde)
            const progressPercent = Math.min((questionCount / 50) * 100, 100);
            const hasDocuments = theme.documents?.length > 0;
            
            return (
              <div 
                key={theme.number} 
                onClick={() => setSelectedTheme(theme)} 
                className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Tema {theme.number}</h3>
                    <p className="text-gray-300 text-xs sm:text-sm mt-1 line-clamp-1">{theme.name}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                      questionCount >= 50 ? 'bg-green-500/20 text-green-400' :
                      questionCount >= 25 ? 'bg-yellow-500/20 text-yellow-400' :
                      questionCount > 0 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {questionCount} pregunta{questionCount !== 1 ? 's' : ''}
                    </span>
                    {hasDocuments && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs">
                        {theme.documents.length} doc{theme.documents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent >= 50 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                      progressPercent >= 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                      progressPercent > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                      'bg-gray-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                
                {questionCount === 0 && !hasDocuments && (
                  <p className="text-gray-500 text-xs mt-2">Sin contenido añadido</p>
                )}
              </div>
            );
          })}
        </div>
        
        {selectedTheme && (
          <ThemeDetailModal 
            key={`theme-${selectedTheme.number}-${selectedTheme.documents?.length || 0}-${selectedTheme.questions?.length || 0}`}
            theme={selectedTheme} 
            onClose={() => setSelectedTheme(null)} 
            onUpdate={handleUpdateTheme}
            showToast={showToast}
          />
        )}

        {/* Modal de importación masiva */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-slate-800 p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-xl">Importar Nombres de Temas</h2>
                  <p className="text-gray-400 text-sm mt-1">Pega la lista completa de tus temas</p>
                </div>
                <button onClick={() => setShowBulkImport(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                  <Icons.X />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <h3 className="text-blue-400 font-semibold text-sm mb-2">📝 Formatos aceptados:</h3>
                  <div className="text-gray-300 text-xs space-y-1 font-mono">
                    <div>1. Constitución Española</div>
                    <div>Tema 2: Derechos Fundamentales</div>
                    <div>3, Organización Territorial</div>
                    <div>4 | Estatuto de Autonomía</div>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 text-sm mb-2 block font-semibold">
                    Pega aquí tu lista (un tema por línea):
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="1. Constitución Española&#10;2. Derechos Fundamentales&#10;3. Organización Territorial&#10;..."
                    className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10 font-mono text-sm min-h-[300px] resize-vertical"
                  />
                  <p className="text-gray-500 text-xs mt-2">
                    {bulkText.split('\n').filter(l => l.trim()).length} líneas detectadas
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowBulkImport(false);
                      setBulkText('');
                    }}
                    className="flex-1 bg-white/5 text-white font-semibold py-3 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={!bulkText.trim()}
                    className="flex-1 bg-blue-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
                  >
                    Importar Nombres
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExamConfigScreen({ themes, onStartExam, onNavigate }) {
  const [numQuestions, setNumQuestions] = useState(20);
  const [selectedThemes, setSelectedThemes] = useState([]);

  const toggleTheme = (num) => {
    setSelectedThemes(prev => 
      prev.includes(num) ? prev.filter(t => t !== num) : [...prev, num]
    );
  };

  const totalAvailable = themes
    .filter(t => selectedThemes.includes(t.number))
    .reduce((sum, t) => sum + (t.questions?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 bg-white/5 rounded-xl">
            <Icons.ChevronLeft />
          </button>
          <h1 className="text-white font-bold text-2xl">Configurar Examen</h1>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <label className="text-gray-300 text-sm mb-2 block">Preguntas</label>
          <select 
            value={numQuestions} 
            onChange={(e) => setNumQuestions(Number(e.target.value))} 
            className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          {totalAvailable > 0 && (
            <p className="text-gray-400 text-xs mt-2">
              {totalAvailable} preguntas disponibles
            </p>
          )}
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-white font-semibold text-sm sm:text-base">Seleccionar Temas</h3>
            <span className="text-gray-400 text-xs sm:text-sm">{selectedThemes.length} seleccionados</span>
          </div>
          
          {/* Botones rápidos */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSelectedThemes(themes.map(t => t.number))}
              className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            >
              ✓ Todos ({themes.length})
            </button>
            <button
              onClick={() => setSelectedThemes(themes.filter(t => t.questions?.length > 0).map(t => t.number))}
              className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            >
              ✓ Con preguntas ({themes.filter(t => t.questions?.length > 0).length})
            </button>
            <button
              onClick={() => {
                const withQuestions = themes.filter(t => t.questions?.length > 0);
                const random = withQuestions.sort(() => Math.random() - 0.5).slice(0, 10);
                setSelectedThemes(random.map(t => t.number));
              }}
              className="bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            >
              🎲 Aleatorio (10)
            </button>
            <button
              onClick={() => setSelectedThemes([])}
              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            >
              ✕ Limpiar
            </button>
          </div>
          
          <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {themes.map(t => (
              <button 
                key={t.number} 
                onClick={() => toggleTheme(t.number)} 
                className={`aspect-square rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm relative transition-all active:scale-95 ${
                  selectedThemes.includes(t.number) ? 'bg-blue-500 text-white scale-105' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {t.number}
                {t.questions?.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold">
                    {t.questions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          onClick={() => onStartExam({ numQuestions, selectedThemes })} 
          disabled={!selectedThemes.length || totalAvailable === 0} 
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 sm:py-4 rounded-xl sm:rounded-2xl disabled:opacity-50 transition-all text-sm sm:text-base"
        >
          {totalAvailable === 0 && selectedThemes.length > 0 
            ? 'No hay preguntas en temas seleccionados' 
            : selectedThemes.length === 0
            ? 'Selecciona al menos un tema'
            : 'Comenzar Examen'}
        </button>
      </div>
    </div>
  );
}

function ExamScreen({ config, themes, onFinish, onNavigate, onUpdateThemes }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  
  // Generar preguntas UNA SOLA VEZ al inicio
  const [questions] = useState(() => {
    const allQuestions = themes
      .filter(t => config.selectedThemes.includes(t.number))
      .flatMap(t => (t.questions || []).map(q => ({ ...q, themeNumber: t.number })));
    
    return allQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(config.numQuestions, allQuestions.length));
  });

  const handleAnswer = (selectedIndex) => {
    const q = questions[current];
    const wasCorrect = selectedIndex === q.correct;
    
    setAnswers({ ...answers, [current]: selectedIndex });
    setAnsweredQuestions(prev => new Set([...prev, current]));
    
    // Actualizar estadísticas de la pregunta
    const theme = themes.find(t => t.number === q.themeNumber);
    if (theme) {
      const updatedQuestions = theme.questions.map(qu => {
        if (qu.id === q.id) {
          return {
            ...qu,
            attempts: (qu.attempts || 0) + 1,
            errors: (qu.errors || 0) + (wasCorrect ? 0 : 1)
          };
        }
        return qu;
      });
      
      onUpdateThemes({
        ...theme,
        questions: updatedQuestions
      });
    }
    
    // Auto-avanzar después de mostrar feedback
    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent(current + 1);
      } else {
        setShowResults(true);
      }
    }, 2500); // 2.5 segundos para ver el feedback
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      setShowResults(true);
    }
  };

  const calculateScore = () => {
    let correct = 0, incorrect = 0;
    
    Object.entries(answers).forEach(([idx, ans]) => {
      const q = questions[idx];
      if (q.correct === ans) correct++;
      else incorrect++;
    });
    
    const penalty = Math.floor(incorrect / 3);
    const final = Math.max(0, correct - penalty);
    return { 
      correct, 
      incorrect, 
      penalty, 
      finalScore: final, 
      percentage: ((final / questions.length) * 100).toFixed(1)
    };
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 flex items-center justify-center">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-md">
          <h2 className="text-white text-xl font-bold mb-4">Sin preguntas</h2>
          <p className="text-gray-400 mb-6">Genera preguntas primero</p>
          <button onClick={() => onNavigate('themes')} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold">
            Ir a Temas
          </button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <h2 className="text-white text-2xl font-bold mb-4">¡Completado!</h2>
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {score.percentage}%
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Correctas</span>
              <span className="text-green-400 font-bold">{score.correct}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Incorrectas</span>
              <span className="text-red-400 font-bold">{score.incorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Penalización</span>
              <span className="text-orange-400 font-bold">-{score.penalty}</span>
            </div>
          </div>
          <button onClick={() => onFinish(score)} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  const userAnswer = answers[current];
  const isAnswered = answeredQuestions.has(current);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-3 sm:p-4 md:p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex justify-between mb-2 gap-2">
            <span className="text-gray-300 text-xs sm:text-sm">Pregunta {current + 1}/{questions.length}</span>
            <span className="text-blue-400 text-xs sm:text-sm font-semibold">Tema {q.themeNumber}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6">
          <p className="text-white text-sm sm:text-base md:text-lg leading-relaxed">{q.text}</p>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = userAnswer === i;
            const wasWrong = isAnswered && isSelected && !isCorrect;
            
            let buttonClass = 'bg-white/5 text-gray-300 hover:bg-white/10';
            
            if (isAnswered) {
              // Ya se respondió esta pregunta
              if (isCorrect) {
                // La correcta siempre en verde
                buttonClass = 'bg-green-500 text-white border-2 border-green-400';
              } else if (isSelected) {
                // La que seleccionó (incorrecta) en rojo
                buttonClass = 'bg-red-500 text-white border-2 border-red-400';
              } else {
                // Las demás opciones grises
                buttonClass = 'bg-white/5 text-gray-400';
              }
            }
            
            return (
              <button 
                key={i} 
                onClick={() => !isAnswered && handleAnswer(i)}
                disabled={isAnswered}
                className={`w-full text-left p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base ${buttonClass} ${isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1">{opt}</span>
                  {isAnswered && isCorrect && (
                    <span className="text-2xl">✓</span>
                  )}
                  {isAnswered && wasWrong && (
                    <span className="text-2xl">✗</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mostrar explicación si está respondido */}
        {isAnswered && (
          <div className={`border rounded-2xl p-4 ${userAnswer === q.correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {userAnswer === q.correct ? (
              <div>
                <p className="text-green-400 font-semibold mb-2">✓ ¡Correcto!</p>
                <p className="text-gray-300 text-sm">
                  La respuesta correcta es: <span className="font-semibold text-white">{q.options[q.correct]}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-red-400 font-semibold mb-2">✗ Incorrecto</p>
                <p className="text-gray-300 text-sm">
                  Tu respuesta: <span className="font-semibold text-red-300">{q.options[userAnswer]}</span>
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  La correcta es: <span className="font-semibold text-green-300">{q.options[q.correct]}</span>
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-3">
          <button 
            onClick={() => setCurrent(c => Math.max(0, c - 1))} 
            disabled={current === 0} 
            className="flex-1 bg-white/5 text-white py-4 rounded-xl disabled:opacity-30"
          >
            Anterior
          </button>
          {isAnswered && (
            <button 
              onClick={handleNext} 
              className="flex-1 bg-blue-500 text-white py-4 rounded-xl"
            >
              {current === questions.length - 1 ? 'Ver Resultados' : 'Siguiente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsScreen({ examHistory, onNavigate, themes }) {
  const totalExams = examHistory.length;
  const avg = totalExams > 0 
    ? (examHistory.reduce((s, e) => s + parseFloat(e.percentage), 0) / totalExams).toFixed(1) 
    : 0;
  
  // Calcular estadísticas avanzadas
  const totalQuestions = examHistory.reduce((s, e) => s + (e.numQuestions || 0), 0);
  const bestScore = totalExams > 0 
    ? Math.max(...examHistory.map(e => parseFloat(e.percentage))) 
    : 0;
  const worstScore = totalExams > 0 
    ? Math.min(...examHistory.map(e => parseFloat(e.percentage))) 
    : 0;
  
  // Calcular racha actual
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const hasStudiedToday = examHistory.some(e => new Date(e.date).toDateString() === today);
  const hasStudiedYesterday = examHistory.some(e => new Date(e.date).toDateString() === yesterday);
  const currentStreak = hasStudiedToday ? (hasStudiedYesterday ? 2 : 1) : 0;
  
  // Nivel y experiencia
  const level = Math.floor(totalQuestions / 100) + 1;
  const xpInLevel = totalQuestions % 100;
  const xpToNextLevel = 100;
  
  // Logros
  const achievements = [
    { 
      id: 'first_exam', 
      name: 'Primer Paso', 
      desc: 'Completa tu primer examen',
      icon: '🎯',
      unlocked: totalExams >= 1,
      progress: totalExams >= 1 ? 100 : 0
    },
    { 
      id: 'perfect_score', 
      name: 'Perfección', 
      desc: 'Saca un 100% en un examen',
      icon: '💯',
      unlocked: bestScore >= 100,
      progress: Math.min(bestScore, 100)
    },
    { 
      id: 'questions_100', 
      name: 'Centenario', 
      desc: 'Responde 100 preguntas',
      icon: '📚',
      unlocked: totalQuestions >= 100,
      progress: Math.min((totalQuestions / 100) * 100, 100)
    },
    { 
      id: 'questions_500', 
      name: 'Experto', 
      desc: 'Responde 500 preguntas',
      icon: '🎓',
      unlocked: totalQuestions >= 500,
      progress: Math.min((totalQuestions / 500) * 100, 100)
    },
    { 
      id: 'streak_7', 
      name: 'Semana Perfecta', 
      desc: 'Estudia 7 días seguidos',
      icon: '🔥',
      unlocked: currentStreak >= 7,
      progress: Math.min((currentStreak / 7) * 100, 100)
    },
    { 
      id: 'exams_10', 
      name: 'Veterano', 
      desc: 'Completa 10 exámenes',
      icon: '⭐',
      unlocked: totalExams >= 10,
      progress: Math.min((totalExams / 10) * 100, 100)
    }
  ];
  
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  
  // Últimos 7 días de actividad
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - i * 86400000);
    const dateStr = date.toDateString();
    const examsToday = examHistory.filter(e => new Date(e.date).toDateString() === dateStr);
    return {
      date: date.toLocaleDateString('es-ES', { weekday: 'short' }),
      count: examsToday.length,
      avgScore: examsToday.length > 0 
        ? (examsToday.reduce((s, e) => s + parseFloat(e.percentage), 0) / examsToday.length).toFixed(0)
        : 0
    };
  }).reverse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
            <Icons.ChevronLeft />
          </button>
          <h1 className="text-white font-bold text-xl sm:text-2xl">Estadísticas</h1>
        </div>
        
        {/* Nivel y XP */}
        <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Nivel de Opositor</p>
              <h2 className="text-white font-bold text-2xl sm:text-3xl">Nivel {level}</h2>
            </div>
            <div className="text-4xl sm:text-5xl">🎖️</div>
          </div>
          <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(xpInLevel / xpToNextLevel) * 100}%` }}
            ></div>
          </div>
          <p className="text-gray-300 text-xs sm:text-sm mt-2 text-center">
            {xpInLevel} / {xpToNextLevel} XP hasta nivel {level + 1}
          </p>
        </div>

        {/* Racha */}
        <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Racha actual</p>
              <h2 className="text-white font-bold text-2xl sm:text-3xl">{currentStreak} días</h2>
              <p className="text-orange-300 text-xs sm:text-sm mt-1">
                {hasStudiedToday ? '✅ Ya estudiaste hoy!' : '⏰ ¡Estudia hoy para mantener la racha!'}
              </p>
            </div>
            <div className="text-4xl sm:text-5xl">🔥</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {avg}%
            </div>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Media</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl sm:text-4xl font-bold text-green-400">{bestScore.toFixed(0)}%</div>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Mejor</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl sm:text-4xl font-bold text-blue-400">{totalExams}</div>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Exámenes</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl sm:text-4xl font-bold text-purple-400">{totalQuestions}</div>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Preguntas</p>
          </div>
        </div>

        {/* Actividad Semanal */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">📊 Últimos 7 días</h3>
          <div className="flex justify-between items-end gap-2">
            {last7Days.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-white/10 rounded-lg overflow-hidden" style={{ height: '100px' }}>
                  <div 
                    className={`w-full bg-gradient-to-t rounded-lg transition-all ${
                      day.count > 0 ? 'from-blue-500 to-purple-500' : 'from-gray-600 to-gray-700'
                    }`}
                    style={{ 
                      height: `${Math.max(day.count * 20, day.count > 0 ? 20 : 10)}%`,
                      marginTop: 'auto'
                    }}
                  ></div>
                </div>
                <p className="text-gray-400 text-xs">{day.date}</p>
                {day.count > 0 && (
                  <p className="text-blue-400 text-xs font-bold">{day.avgScore}%</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Logros */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm sm:text-base">🏆 Logros</h3>
            <span className="text-gray-400 text-xs sm:text-sm">{unlockedCount}/{achievements.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievements.map(achievement => (
              <div 
                key={achievement.id}
                className={`p-3 sm:p-4 rounded-xl border transition-all ${
                  achievement.unlocked 
                    ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30 scale-105' 
                    : 'bg-white/5 border-white/10 opacity-50'
                }`}
              >
                <div className="text-2xl sm:text-3xl mb-2 text-center">{achievement.icon}</div>
                <h4 className={`font-semibold text-xs sm:text-sm text-center mb-1 ${
                  achievement.unlocked ? 'text-yellow-300' : 'text-gray-400'
                }`}>
                  {achievement.name}
                </h4>
                <p className="text-gray-500 text-[10px] sm:text-xs text-center mb-2">{achievement.desc}</p>
                {!achievement.unlocked && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${achievement.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Historial */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">📋 Historial Reciente</h3>
          {totalExams > 0 ? (
            <div className="space-y-2">
              {examHistory.slice(0, 10).map((e, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      parseFloat(e.percentage) >= 80 ? 'bg-green-500' :
                      parseFloat(e.percentage) >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}></div>
                    <span className="text-gray-300 text-xs sm:text-sm">
                      {new Date(e.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">{e.numQuestions || 0}p</span>
                    <span className={`font-bold text-sm sm:text-base ${
                      parseFloat(e.percentage) >= 80 ? 'text-green-400' :
                      parseFloat(e.percentage) >= 50 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {e.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl sm:text-5xl mb-3">📝</div>
              <p className="text-gray-400 font-medium text-sm sm:text-base">No has hecho exámenes aún</p>
              <p className="text-gray-600 text-xs sm:text-sm mt-1">¡Haz tu primer examen para empezar!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HEATMAP SCREEN - MAPA DE CALOR COGNITIVO
// ============================================================================

function HeatmapScreen({ themes, onNavigate }) {
  // Calcular estadísticas por tema
  const themeStats = themes.map(theme => {
    const questions = theme.questions || [];
    const total = questions.length;
    const attempted = questions.filter(q => q.attempts && q.attempts > 0).length;
    const errors = questions.reduce((sum, q) => sum + (q.errors || 0), 0);
    const attempts = questions.reduce((sum, q) => sum + (q.attempts || 0), 0);
    const errorRate = attempts > 0 ? (errors / attempts) * 100 : 0;
    
    return {
      number: theme.number,
      name: theme.name,
      total,
      attempted,
      errors,
      attempts,
      errorRate: Math.round(errorRate)
    };
  }).filter(t => t.attempts > 0); // Solo temas con intentos

  // Ordenar por tasa de error (descendente)
  const sortedByError = [...themeStats].sort((a, b) => b.errorRate - a.errorRate);
  const top10Critical = sortedByError.slice(0, 10);

  // Función para obtener color según error rate
  const getHeatColor = (errorRate) => {
    if (errorRate >= 70) return 'bg-red-500 text-white';
    if (errorRate >= 50) return 'bg-orange-500 text-white';
    if (errorRate >= 30) return 'bg-yellow-500 text-black';
    if (errorRate >= 10) return 'bg-green-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const getHeatLabel = (errorRate) => {
    if (errorRate >= 70) return 'Crítico';
    if (errorRate >= 50) return 'Difícil';
    if (errorRate >= 30) return 'Medio';
    if (errorRate >= 10) return 'Bien';
    return 'Excelente';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 bg-white/5 rounded-xl">
            <Icons.ChevronLeft />
          </button>
          <h1 className="text-white font-bold text-xl sm:text-2xl">Mapa de Calor</h1>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-white font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
            🔥 Top 10 Temas Críticos
          </h2>
          {top10Critical.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {top10Critical.map((stat, idx) => (
                <div key={stat.number} className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-400 min-w-[40px] sm:min-w-[50px]">#{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 sm:mb-2 gap-2">
                        <h3 className="text-white font-semibold text-sm sm:text-base truncate">Tema {stat.number}</h3>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getHeatColor(stat.errorRate)}`}>
                          {stat.errorRate}%
                        </span>
                      </div>
                      <p className="text-gray-300 text-xs sm:text-sm mb-1 sm:mb-2 line-clamp-1">{stat.name}</p>
                      <div className="flex gap-2 sm:gap-4 text-xs flex-wrap">
                        <span className="text-gray-400">
                          {stat.errors}/{stat.attempts} errores
                        </span>
                        <span className="text-gray-400">
                          {stat.attempted}/{stat.total} preguntas vistas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-400">Completa exámenes para ver tu mapa de calor</p>
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Vista General por Tema</h2>
          {/* Grid adaptativo: 6 cols en móvil, 9 en tablet, 10 en desktop */}
          <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {themes.map(theme => {
              const stat = themeStats.find(s => s.number === theme.number);
              const errorRate = stat ? stat.errorRate : 0;
              const hasData = stat && stat.attempts > 0;
              
              return (
                <div
                  key={theme.number}
                  className={`aspect-square rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                    hasData ? getHeatColor(errorRate) : 'bg-gray-700 text-gray-500'
                  }`}
                  title={`Tema ${theme.number}: ${theme.name} - ${errorRate}% error`}
                >
                  {theme.number}
                </div>
              );
            })}
          </div>
          
          {/* Leyenda responsive */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-4 sm:mt-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-blue-500"></div>
              <span className="text-[10px] sm:text-xs text-gray-400">Excelente</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-500"></div>
              <span className="text-[10px] sm:text-xs text-gray-400">Bien</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-yellow-500"></div>
              <span className="text-[10px] sm:text-xs text-gray-400">Medio</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-orange-500"></div>
              <span className="text-[10px] sm:text-xs text-gray-400">Difícil</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-500"></div>
              <span className="text-[10px] sm:text-xs text-gray-400">Crítico</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h3 className="text-blue-400 font-semibold mb-2 sm:mb-3 text-sm sm:text-base">💡 ¿Cómo usar el mapa de calor?</h3>
          <ul className="text-gray-300 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
            <li>• <span className="text-red-400 font-semibold">Rojo</span>: Temas que necesitas repasar urgentemente</li>
            <li>• <span className="text-yellow-500 font-semibold">Amarillo</span>: Temas que requieren más práctica</li>
            <li>• <span className="text-green-400 font-semibold">Verde</span>: Temas que dominas bien</li>
            <li>• <span className="text-gray-400 font-semibold">Gris</span>: Temas sin datos todavía</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS SCREEN
// ============================================================================

function SettingsScreen({ onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await storage.get('user-profile');
      const savedProfile = p || {
        name: 'Usuario',
        examName: 'Mi Oposición',
        numThemes: 90,
        penaltySystem: 'classic'
      };
      setProfile(savedProfile);
      setDarkMode(savedProfile.darkMode || false);
      setNotifications(savedProfile.notifications || false);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const updatedProfile = {
      ...profile,
      darkMode,
      notifications
    };
    await storage.set('user-profile', updatedProfile);
    alert('✅ Configuración guardada correctamente');
  };

  const handleExportToExcel = async () => {
    try {
      // Obtener todos los temas con preguntas
      const allThemes = await storage.get('pasaeltest-themes');
      if (!allThemes || allThemes.length === 0) {
        alert('❌ No hay temas para exportar');
        return;
      }

      // Contar preguntas totales
      let totalQuestions = 0;
      allThemes.forEach(theme => {
        totalQuestions += theme.questions?.length || 0;
      });

      if (totalQuestions === 0) {
        alert('❌ No hay preguntas generadas para exportar');
        return;
      }

      // Crear CSV (Excel compatible)
      let csvContent = "Tema,Número Tema,Pregunta,Opción A,Opción B,Opción C,Correcta,Dificultad,Explicación\n";
      
      allThemes.forEach(theme => {
        if (theme.questions && theme.questions.length > 0) {
          theme.questions.forEach(q => {
            const row = [
              `"${theme.name}"`,
              theme.number,
              `"${q.text}"`,
              `"${q.options[0] || ''}"`,
              `"${q.options[1] || ''}"`,
              `"${q.options[2] || ''}"`,
              q.correct === 0 ? 'A' : q.correct === 1 ? 'B' : 'C',
              q.difficulty || 'media',
              `"${q.explanation || ''}"`
            ].join(',');
            csvContent += row + "\n";
          });
        }
      });

      // Crear blob y descargar
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `opositia_preguntas_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`✅ ${totalQuestions} preguntas exportadas correctamente\n\nArchivo: opositia_preguntas_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('❌ Error al exportar. Intenta de nuevo.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900'} p-4 sm:p-6 pb-24 transition-colors duration-300`}>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
            <Icons.ChevronLeft />
          </button>
          <h1 className="text-white font-bold text-xl sm:text-2xl">Configuración</h1>
        </div>

        {/* PERFIL */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-base sm:text-lg mb-1">👤 Perfil</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Personaliza tu información</p>
          </div>
          
          <div>
            <label className="text-gray-300 text-sm mb-2 block">Tu nombre</label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={(e) => setProfile({...profile, name: e.target.value})}
              placeholder="¿Cómo te llamas?"
              className="w-full bg-white/5 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base"
            />
          </div>

          <div>
            <label className="text-gray-300 text-sm mb-2 block">Oposición que estudias</label>
            <input
              type="text"
              value={profile.examName || ''}
              onChange={(e) => setProfile({...profile, examName: e.target.value})}
              placeholder="Ej: Guardia Civil, Administrativo Estado..."
              className="w-full bg-white/5 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base"
            />
            <p className="text-gray-500 text-xs mt-1">Esto aparecerá en tu pantalla principal</p>
          </div>

          <div>
            <label className="text-gray-300 text-sm mb-2 block">Número de temas</label>
            <input
              type="number"
              min="1"
              max="200"
              value={profile.numThemes || 90}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 200) {
                  setProfile({...profile, numThemes: value});
                }
              }}
              className="w-full bg-white/5 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base"
              placeholder="Ej: 90"
            />
            <p className="text-gray-500 text-xs mt-1">
              Introduce el número de temas de tu oposición (entre 1 y 200)
            </p>
          </div>

          <div>
            <label className="text-gray-300 text-sm mb-2 block">Sistema de penalización</label>
            <select
              value={profile.penaltySystem || 'classic'}
              onChange={(e) => setProfile({...profile, penaltySystem: e.target.value})}
              className="w-full bg-white/5 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base"
            >
              <option value="classic">Clásico: Cada 3 incorrectas resta 1</option>
              <option value="each2">Cada 2 incorrectas resta 1</option>
              <option value="each4">Cada 4 incorrectas resta 1</option>
              <option value="none">Sin penalización</option>
            </select>
            <p className="text-gray-500 text-xs mt-1">
              {profile.penaltySystem === 'classic' && '3 fallos = -1 punto (estándar oposiciones)'}
              {profile.penaltySystem === 'each2' && '2 fallos = -1 punto (más estricto)'}
              {profile.penaltySystem === 'each4' && '4 fallos = -1 punto (más permisivo)'}
              {profile.penaltySystem === 'none' && 'Solo cuentan los aciertos'}
            </p>
          </div>
        </div>

        {/* APARIENCIA */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-base sm:text-lg mb-1">🎨 Apariencia</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Personaliza la interfaz</p>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div>
              <span className="text-white text-sm sm:text-base font-medium">Modo oscuro</span>
              <p className="text-gray-400 text-xs">Reduce la fatiga visual</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative w-14 h-7 rounded-full transition-colors ${darkMode ? 'bg-blue-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-7' : ''}`}></div>
            </button>
          </div>
        </div>

        {/* NOTIFICACIONES */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-base sm:text-lg mb-1">🔔 Notificaciones</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Mantente al día con tu estudio</p>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div>
              <span className="text-white text-sm sm:text-base font-medium">Recordatorios diarios</span>
              <p className="text-gray-400 text-xs">Te avisaremos para estudiar</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative w-14 h-7 rounded-full transition-colors ${notifications ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${notifications ? 'translate-x-7' : ''}`}></div>
            </button>
          </div>
          {notifications && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-400 text-xs sm:text-sm">✅ Recibirás un recordatorio diario a las 20:00h</p>
            </div>
          )}
        </div>

        {/* EXPORTAR DATOS */}
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-base sm:text-lg mb-1">📊 Exportar Datos</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Descarga tus preguntas generadas</p>
          </div>
          
          <button
            onClick={handleExportToExcel}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span className="text-lg">📥</span>
            Exportar Preguntas a Excel (.csv)
          </button>
          <p className="text-gray-500 text-xs text-center">
            El archivo se puede abrir en Excel, Google Sheets o cualquier editor de hojas de cálculo
          </p>
        </div>

        {/* BOTÓN GUARDAR */}
        <button
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all active:scale-[0.98] text-sm sm:text-base shadow-lg"
        >
          💾 Guardar Todos los Cambios
        </button>

        {/* INFO */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h3 className="text-blue-400 font-semibold mb-2 text-sm sm:text-base">💡 Sobre PasaElTest</h3>
          <ul className="text-gray-300 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
            <li>• <strong>Versión:</strong> 2.2 Full Features</li>
            <li>• <strong>Preguntas por generación:</strong> 25</li>
            <li>• <strong>Almacenamiento:</strong> Nube (persistente)</li>
            <li>• <strong>Búsquedas IA:</strong> Web search integrado</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BOTTOM NAV
// ============================================================================

function BottomNav({ current, onNavigate }) {
  const items = [
    { id: 'home', icon: Icons.Home, label: 'Inicio' },
    { id: 'themes', icon: Icons.Book, label: 'Temas' },
    { id: 'heatmap', icon: Icons.Fire, label: 'Mapa' },
    { id: 'stats', icon: Icons.Stats, label: 'Stats' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2 sm:px-4 py-2 sm:py-3 safe-area-inset-bottom">
      <div className="flex justify-around max-w-2xl mx-auto">
        {items.map(item => (
          <button 
            key={item.id} 
            onClick={() => onNavigate(item.id)} 
            className={`flex flex-col items-center gap-0.5 sm:gap-1 px-3 sm:px-4 py-2 rounded-xl min-w-[60px] sm:min-w-[70px] transition-all active:scale-95 ${
              current === item.id ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500'
            }`}
          >
            <item.icon />
            <span className="text-[10px] sm:text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [themes, setThemes] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [examConfig, setExamConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  
  // Sistema de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  
  // Sistema de toast notifications
  const { toasts, showToast, removeToast } = useToast();

  // Verificar sesión de Supabase al cargar
  useEffect(() => {
    checkSession();
    
    // Listener para cambios de autenticación
    const { data: { subscription } } = authHelpers.onAuthStateChange(
      async (event, session) => {
        if (DEBUG) console.log('Auth event:', event, session);
        
        if (event === 'SIGNED_IN' && session) {
          // Usuario logueado
          const user = session.user;
          setCurrentUser({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || 'Usuario',
            oposicion: user.user_metadata?.oposicion || 'Sin especificar',
            subscription: 'free',
            isGuest: false,
            isFirstLogin: false
          });
          setIsAuthenticated(true);
          setAuthLoading(false);
          
        } else if (event === 'SIGNED_OUT') {
          // Usuario cerró sesión
          setCurrentUser(null);
          setIsAuthenticated(false);
          setThemes([]);
          setExamHistory([]);
          setProfile(null);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    setAuthLoading(true);
    const { user } = await authHelpers.getUser();
    
    if (user) {
      setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'Usuario',
        oposicion: user.user_metadata?.oposicion || 'Sin especificar',
        subscription: 'free',
        isGuest: false,
        isFirstLogin: false
      });
      setIsAuthenticated(true);
    }
    
    setAuthLoading(false);
  };

  // Cargar datos del usuario autenticado desde Supabase
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    if (currentUser.isGuest) {
      // Para invitados, inicializar datos locales
      setLoading(true);
      
      const guestProfile = {
        name: currentUser.name,
        examName: currentUser.oposicion,
        numThemes: 90,
        penaltySystem: 'classic',
        darkMode: false,
        notifications: false
      };
      setProfile(guestProfile);
      
      // Crear temas locales para invitado
      const initialThemes = Array.from({ length: 90 }, (_, i) => ({ 
        number: i + 1, 
        name: `Tema ${i + 1}`, 
        documents: [], 
        questions: [] 
      }));
      setThemes(initialThemes);
      
      setLoading(false);
    } else {
      // Para usuarios registrados, cargar desde Supabase
      loadUserData();
    }
  }, [isAuthenticated, currentUser]);

  const loadUserData = async () => {
    if (!currentUser || currentUser.isGuest) return;
    
    setLoading(true);
    
    try {
      // Cargar perfil del usuario
      const profileData = {
        name: currentUser.name,
        examName: currentUser.oposicion,
        numThemes: 90,
        penaltySystem: 'classic',
        darkMode: false,
        notifications: false
      };
      setProfile(profileData);
      
      // Cargar temas desde Supabase
      const { data: themesData, error: themesError } = await dbHelpers.getThemes(currentUser.id);
      
      if (themesError) {
        console.error('Error loading themes:', themesError);
        // Inicializar temas vacíos si hay error
        const initialThemes = Array.from({ length: 90 }, (_, i) => ({ 
          number: i + 1, 
          name: `Tema ${i + 1}`, 
          documents: [], 
          questions: [] 
        }));
        setThemes(initialThemes);
      } else if (themesData && themesData.length > 0) {
        // Convertir formato de Supabase a formato de la app
        const themes = themesData.map(theme => ({
          id: theme.id, // UUID de Supabase
          number: theme.number,
          name: theme.name,
          documents: theme.documents || [],
          questions: theme.questions || []
        }));
        setThemes(themes);
      } else {
        // Si no hay temas, crear los iniciales
        const initialThemes = Array.from({ length: 90 }, (_, i) => ({ 
          number: i + 1, 
          name: `Tema ${i + 1}`, 
          documents: [], 
          questions: [] 
        }));
        
        // Crear temas en Supabase
        for (const theme of initialThemes) {
          await dbHelpers.createTheme(currentUser.id, {
            number: theme.number,
            name: theme.name
          });
        }
        
        // Recargar temas
        const { data: newThemesData } = await dbHelpers.getThemes(currentUser.id);
        if (newThemesData) {
          const themes = newThemesData.map(theme => ({
            id: theme.id,
            number: theme.number,
            name: theme.name,
            documents: [],
            questions: []
          }));
          setThemes(themes);
        }
      }

      // Cargar historial de exámenes
      const { data: examsData } = await dbHelpers.getExamHistory(currentUser.id);
      if (examsData) {
        const history = examsData.map(exam => ({
          ...exam.config,
          score: exam.score,
          date: exam.created_at
        }));
        setExamHistory(history);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
      // En caso de error, inicializar con datos vacíos
      const initialThemes = Array.from({ length: 90 }, (_, i) => ({ 
        number: i + 1, 
        name: `Tema ${i + 1}`, 
        documents: [], 
        questions: [] 
      }));
      setThemes(initialThemes);
    }
    
    setLoading(false);
  };

  // Handlers de autenticación
  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (user.isFirstLogin) {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = (newProfile, updatedUser) => {
    setProfile(newProfile);
    setShowOnboarding(false);
    
    // Si viene un usuario actualizado, actualizarlo
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }
  };

  const handleLogout = async () => {
    try {
      if (currentUser && !currentUser.isGuest) {
        await authHelpers.signOut();
      }
      setCurrentUser(null);
      setIsAuthenticated(false);
      setThemes([]);
      setExamHistory([]);
      setProfile(null);
      setScreen('home');
    } catch (error) {
      console.error('Error logging out:', error);
      // Forzar logout local incluso si falla en Supabase
      setCurrentUser(null);
      setIsAuthenticated(false);
      setThemes([]);
      setExamHistory([]);
      setProfile(null);
      setScreen('home');
    }
  };

  const updateTheme = async (theme) => {
    if (!currentUser || currentUser.isGuest) {
      // Para invitados, solo actualizar estado local
      const newThemes = themes.map(t => t.number === theme.number ? theme : t);
      setThemes(newThemes);
      return;
    }
    
    try {
      // Actualizar en Supabase
      if (theme.id) {
        const { error } = await dbHelpers.updateTheme(theme.id, {
          name: theme.name,
          number: theme.number
        });

        if (error) {
          console.error('Error updating theme:', error);
          showToast?.('Error al guardar cambios', 'error');
          return;
        }
      }

      // Actualizar estado local
      const newThemes = themes.map(t => t.number === theme.number ? theme : t);
      setThemes(newThemes);
      
    } catch (error) {
      console.error('Error in updateTheme:', error);
      showToast?.('Error al guardar cambios', 'error');
    }
  };

  const startExam = (config) => {
    setExamConfig(config);
    setScreen('exam-active');
  };

  const finishExam = async (score) => {
    if (!currentUser) return;
    
    const result = { 
      ...score, 
      date: new Date().toISOString(), 
      numQuestions: examConfig.numQuestions 
    };
    
    // Guardar en historial local
    const newHistory = [result, ...examHistory];
    setExamHistory(newHistory);
    
    // Si no es invitado, guardar en Supabase
    if (!currentUser.isGuest) {
      try {
        await dbHelpers.saveExamResult(currentUser.id, examConfig, score);
      } catch (error) {
        console.error('Error saving exam result:', error);
      }
    }
    
    setScreen('home');
  };

  const stats = {
    totalExams: examHistory.length,
    totalQuestions: examHistory.reduce((s, e) => s + (e.numQuestions || 0), 0),
    avgScore: examHistory.length > 0 
      ? Math.round(examHistory.reduce((s, e) => s + parseFloat(e.percentage), 0) / examHistory.length) 
      : 0,
    themesCompleted: themes.filter(t => t.questions?.length > 0).length
  };

  // Loading inicial de autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
            PasaElTest
          </div>
          <p className="text-gray-400 mt-2">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // No autenticado - mostrar login
  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <AuthScreen onLogin={handleLogin} showToast={showToast} />
      </>
    );
  }

  // Autenticado pero primera vez - mostrar onboarding
  if (showOnboarding) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <OnboardingScreen 
          user={currentUser} 
          onComplete={handleOnboardingComplete}
          showToast={showToast}
        />
      </>
    );
  }

  // Loading de datos del usuario
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            PasaElTest
          </div>
          <p className="text-gray-400 mt-2">Cargando tus datos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Modal de perfil */}
      {showUserProfile && (
        <UserProfileModal
          user={currentUser}
          profile={profile}
          onClose={() => setShowUserProfile(false)}
          onLogout={handleLogout}
          onUpdateProfile={setProfile}
          showToast={showToast}
        />
      )}
      
      {screen === 'home' && (
        <HomeScreen 
          onNavigate={setScreen} 
          stats={stats} 
          profile={profile}
          user={currentUser}
          onShowProfile={() => setShowUserProfile(true)}
        />
      )}
      {screen === 'themes' && <ThemesScreen themes={themes} onUpdateTheme={updateTheme} onNavigate={setScreen} showToast={showToast} />}
      {screen === 'exam' && <ExamConfigScreen themes={themes} onStartExam={startExam} onNavigate={setScreen} />}
      {screen === 'exam-active' && (
        <ExamScreen 
          config={examConfig} 
          themes={themes} 
          onFinish={finishExam} 
          onNavigate={setScreen} 
          onUpdateThemes={updateTheme} 
        />
      )}
      {screen === 'stats' && <StatsScreen examHistory={examHistory} onNavigate={setScreen} themes={themes} />}
      {screen === 'heatmap' && <HeatmapScreen themes={themes} onNavigate={setScreen} />}
      {screen === 'settings' && <SettingsScreen onNavigate={setScreen} />}
      <BottomNav current={screen} onNavigate={setScreen} />
    </>
  );
}
