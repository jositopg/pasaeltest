import React, { useState, useEffect, useRef } from 'react';
import { supabase, authHelpers, dbHelpers } from './supabaseClient';
import { chunkDocument, estimateQuestions, formatEstimatedTime } from './utils/textChunking';
import { parseExcelQuestions, parsePDFQuestions, downloadExcelTemplate, generatePDFTemplate } from './utils/questionImporter';
import { analyzeDocument, determineQuestionTypes } from './utils/documentAnalyzer';
import { OPTIMIZED_QUESTION_PROMPT, OPTIMIZED_PHASE2_PROMPT, OPTIMIZED_SEARCH_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT } from './utils/optimizedPrompts';

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
    <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center p-5"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 60%)' }}>
      
      {/* Logo */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}>
          <span className="text-white text-3xl font-black" style={{ fontFamily: 'Sora, system-ui' }}>P</span>
        </div>
        <h1 className="text-4xl font-black" style={{ fontFamily: 'Sora, system-ui', background: 'linear-gradient(135deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PasaElTest
        </h1>
        <p className="text-slate-500 text-sm mt-1">Tu asistente inteligente de oposiciones</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#0F172A] border border-[#1E293B] rounded-3xl p-6 shadow-2xl animate-fade-in-up">
        
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl bg-[#080C14]">
          {[['login', 'Entrar'], ['register', 'Registrarse']].map(([mode, label]) => (
            <button key={mode}
              onClick={() => setIsLogin(mode === 'login')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${(mode === 'login') === isLogin
                  ? 'text-white shadow-lg'
                  : 'text-slate-500 hover:text-slate-300'}`}
              style={(mode === 'login') === isLogin
                ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }
                : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Nombre</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Tu nombre completo"
                  className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Oposición</label>
                <select required value={formData.oposicion}
                  onChange={(e) => setFormData({...formData, oposicion: e.target.value})}
                  className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors">
                  <option value="" className="bg-slate-800">Selecciona tu oposición</option>
                  {['Guardia Civil','Policía Nacional','Administración General','Justicia','Correos','Hacienda','Educación','Sanidad','Otra'].map(o => (
                    <option key={o} value={o} className="bg-slate-800">{o}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Email</label>
            <input type="email" required value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="tu@email.com"
              className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Contraseña</label>
            <input type="password" required value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
              className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98] mt-1"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', boxShadow: '0 4px 20px rgba(37,99,235,0.3)', fontFamily: 'Sora, system-ui' }}>
            {loading ? '⏳ Procesando...' : (isLogin ? 'Iniciar sesión →' : 'Crear cuenta →')}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[#1E293B]" />
          <span className="text-xs text-slate-600">o</span>
          <div className="flex-1 h-px bg-[#1E293B]" />
        </div>

        {/* Demo */}
        <button onClick={handleGuestMode}
          className="w-full py-3 rounded-xl border border-[#334155] text-slate-400 text-sm font-semibold hover:border-slate-500 hover:text-slate-300 transition-all active:scale-[0.98]">
          👤 Probar sin registrarme
        </button>

        <p className="text-slate-700 text-xs text-center mt-4">
          Modo demo: los datos no se guardan
        </p>
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

function HomeScreen({ onNavigate, stats, profile, user, onShowProfile, darkMode }) {
  const dm = darkMode;
  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>
      
      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest ${dm ? 'text-blue-400' : 'text-blue-600'}`}>
              {profile?.examName || 'Mi Oposición'}
            </p>
            <h1 className="font-display text-2xl font-bold mt-0.5" style={{ fontFamily: 'Sora, system-ui' }}>
              <span style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                PasaElTest
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('settings')}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
                ${dm ? 'bg-[#1E293B] text-slate-400 hover:text-slate-200' : 'bg-white text-slate-400 hover:text-slate-700 shadow-sm'}`}
            >
              <Icons.Settings />
            </button>
            {user && (
              <button
                onClick={onShowProfile}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm transition-all shadow-md"
                style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
              >
                {user.isGuest ? '👤' : user.name?.charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* BANNER INVITADO */}
        {user?.isGuest && (
          <div className="rounded-2xl p-4 border border-amber-400/30 animate-fade-in"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.1))' }}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-400 text-sm">Modo Prueba — Datos temporales</p>
                <p className={`text-xs mt-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tu progreso no se guarda al cerrar sesión.
                </p>
                <button
                  onClick={() => window.confirm('¿Registrarte ahora? Perderás los datos actuales.') && onNavigate('settings')}
                  className="mt-2 text-xs font-semibold text-amber-400 underline underline-offset-2"
                >
                  Crear cuenta gratis →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SALUDO */}
        <div className={`rounded-2xl p-5 animate-fade-in-up stagger-1
          ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-md'}`}>
          <p className={`text-sm ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
            {user?.isGuest ? 'Bienvenido al modo prueba' : `Hola, ${user?.name?.split(' ')[0] || 'usuario'} 👋`}
          </p>
          <p className={`font-display font-bold text-xl mt-1 ${dm ? 'text-slate-100' : 'text-slate-800'}`}
            style={{ fontFamily: 'Sora, system-ui' }}>
            ¿Qué estudias hoy?
          </p>
          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs font-medium ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                Progreso general
              </span>
              <span className="text-xs font-bold" style={{ color: '#2563EB' }}>
                {stats.themesCompleted || 0}/90 temas
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${dm ? 'bg-[#1E293B]' : 'bg-slate-100'}`}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((stats.themesCompleted || 0) / 90 * 100)}%`,
                  background: 'linear-gradient(90deg, #2563EB, #7C3AED)'
                }}
              />
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in-up stagger-2">
          {[
            { label: 'Exámenes', value: stats.totalExams || 0, icon: '📝' },
            { label: 'Media', value: `${stats.avgScore || 0}%`, icon: '🎯' },
            { label: 'Preguntas', value: stats.totalQuestions || 0, icon: '❓' },
          ].map((stat, i) => (
            <div key={i}
              className={`rounded-2xl p-3 text-center
                ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`}>
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="font-display font-bold text-lg" style={{ fontFamily: 'Sora, system-ui', color: '#2563EB' }}>
                {stat.value}
              </div>
              <div className={`text-[10px] font-medium mt-0.5 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ACCIONES PRINCIPALES */}
        <div className="space-y-3 animate-fade-in-up stagger-3">
          {/* Botón principal */}
          <button
            onClick={() => onNavigate('exam')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div className="text-left">
                <div className="text-sm font-bold" style={{ fontFamily: 'Sora, system-ui' }}>Crear Examen</div>
                <div className="text-xs opacity-75">Practica con preguntas tipo test</div>
              </div>
            </div>
            <span className="text-xl opacity-60">→</span>
          </button>

          {/* Botones secundarios */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('heatmap')}
              className={`flex flex-col items-start gap-2 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]
                ${dm ? 'bg-[#0F172A] border border-[#1E293B] hover:border-orange-500/30' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'}`}
            >
              <span className="text-2xl">🔥</span>
              <div>
                <div className={`text-sm font-bold ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
                  Mapa de Calor
                </div>
                <div className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Ver progreso</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('themes')}
              className={`flex flex-col items-start gap-2 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]
                ${dm ? 'bg-[#0F172A] border border-[#1E293B] hover:border-blue-500/30' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'}`}
            >
              <span className="text-2xl">📚</span>
              <div>
                <div className={`text-sm font-bold ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
                  Temas
                </div>
                <div className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Gestionar contenido</div>
              </div>
            </button>
          </div>
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
      
      // Llamada a nuestra función serverless en lugar de directamente a Anthropic
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name),
          maxTokens: 4000
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
      
      // Llamada a nuestra función serverless
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: OPTIMIZED_QUESTION_PROMPT(
            theme.name,
            numToGenerate,
            documentContents.substring(0, 35000),
            existingQuestions
          ),
          useWebSearch: false,
          maxTokens: 8000
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
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: OPTIMIZED_SEARCH_PROMPT(docContent, theme.name),
          maxTokens: 8000
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
      
      // Gemini no puede acceder directamente a URLs
      // Mostrar mensaje informativo
      if (showToast) {
        showToast('⚠️ La función de URLs requiere procesamiento especial. Por favor, copia el contenido de la página y pégalo en "Texto personalizado", o sube un archivo PDF/Word.', 'warning');
      }
      return;
      
      setIsSearching(true);
      setGenerationProgress('🌐 Obteniendo contenido de la web...');
      setGenerationPercent(20);
      
      try {
        const response = await fetch("/api/generate-gemini", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `Obtén el contenido de esta URL y estructúralo para el tema "${theme.name}":

URL: ${docContent}

Extrae y estructura la información relevante:

# ${theme.name}

## CONTENIDO PRINCIPAL
[Conceptos, definiciones, puntos clave]

## DETALLES IMPORTANTES
[Datos, cifras, procedimientos]

## INFORMACIÓN COMPLEMENTARIA
[Casos prácticos, ejemplos]

Proporciona un documento completo con TODA la información del enlace.`,
            useWebSearch: true,
            maxTokens: 8000
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
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-white/10">
                  <option value="ai-search" className="bg-slate-800 text-white">🤖 Buscar con IA (Recomendado)</option>
                  <option value="text" className="bg-slate-800 text-white">📝 Pegar Texto Directamente</option>
                  <option value="url" className="bg-slate-800 text-white">🔗 Enlace Web</option>
                  <option value="pdf" className="bg-slate-800 text-white">📄 Subir Archivo (PDF/TXT)</option>
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
            {/* COMPONENTE DE IMPORTACIÓN DE PREGUNTAS */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-300/30 rounded-xl p-6 mb-4">
              <h3 className="text-lg font-semibold mb-4 text-purple-300 flex items-center gap-2">
                📥 Importar Preguntas
              </h3>
              
              {/* Plantillas */}
              <div className="mb-4 bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold text-gray-300 mb-2">
                  📋 Descargar plantillas:
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => downloadExcelTemplate()}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2 text-sm font-medium shadow-sm"
                  >
                    📊 Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => {
                      const template = generatePDFTemplate();
                      const blob = new Blob([template], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'plantilla_preguntas.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                      if (showToast) showToast('📄 Plantilla de texto descargada', 'success');
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm font-medium shadow-sm"
                  >
                    📄 Texto (.txt)
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Descarga la plantilla, rellénala con tus preguntas y súbela abajo
                </p>
              </div>

              {/* Input de archivo */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold text-gray-300 mb-2">
                  📂 Subir archivo con preguntas:
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.txt"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                      setIsGeneratingQuestions(true);
                      setGenerationProgress('📥 Leyendo archivo...');
                      setGenerationPercent(10);

                      let questions;
                      
                      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        setGenerationProgress('📊 Procesando Excel...');
                        setGenerationPercent(30);
                        questions = await parseExcelQuestions(file);
                      } else if (file.name.endsWith('.txt')) {
                        setGenerationProgress('📄 Procesando texto...');
                        setGenerationPercent(30);
                        const text = await file.text();
                        questions = await parsePDFQuestions(text);
                      } else {
                        throw new Error('Formato no soportado. Usa .xlsx o .txt');
                      }

                      if (!questions || questions.length === 0) {
                        throw new Error('No se encontraron preguntas válidas en el archivo');
                      }

                      setGenerationProgress('✓ Validando preguntas...');
                      setGenerationPercent(70);

                      const validQuestions = questions.filter(q => {
                        return q.text && 
                               q.text.length > 10 && 
                               Array.isArray(q.options) && 
                               q.options.length === 3 &&
                               q.correct >= 0 && 
                               q.correct <= 2;
                      });

                      if (validQuestions.length === 0) {
                        throw new Error('Ninguna pregunta pasó la validación. Revisa el formato.');
                      }

                      if (validQuestions.length < questions.length) {
                        const invalid = questions.length - validQuestions.length;
                        if (showToast) {
                          showToast(
                            `⚠️ ${invalid} pregunta${invalid > 1 ? 's' : ''} no válida${invalid > 1 ? 's' : ''} (formato incorrecto)`,
                            'warning'
                          );
                        }
                      }

                      setGenerationProgress('💾 Guardando preguntas...');
                      setGenerationPercent(90);

                      const updatedTheme = {
                        ...theme,
                        questions: [...(theme.questions || []), ...validQuestions]
                      };
                      onUpdate(updatedTheme);
                      
                      setGenerationProgress(`✅ ${validQuestions.length} preguntas importadas`);
                      setGenerationPercent(100);

                      if (showToast) {
                        showToast(
                          `✅ ${validQuestions.length} pregunta${validQuestions.length > 1 ? 's' : ''} importada${validQuestions.length > 1 ? 's' : ''} exitosamente`,
                          'success'
                        );
                      }

                      setTimeout(() => {
                        setIsGeneratingQuestions(false);
                        setGenerationProgress('');
                        setGenerationPercent(0);
                      }, 2000);

                    } catch (error) {
                      console.error('Error importando preguntas:', error);
                      
                      setGenerationProgress(`❌ Error: ${error.message}`);
                      
                      if (showToast) {
                        showToast(`❌ Error: ${error.message}`, 'error');
                      }

                      setTimeout(() => {
                        setIsGeneratingQuestions(false);
                        setGenerationProgress('');
                        setGenerationPercent(0);
                      }, 3000);
                    }
                    
                    e.target.value = '';
                  }}
                  className="block w-full text-sm text-gray-300
                             file:mr-4 file:py-2.5 file:px-4 
                             file:rounded-lg file:border-0 
                             file:text-sm file:font-semibold 
                             file:bg-purple-500/20 file:text-purple-300 
                             hover:file:bg-purple-500/30 
                             file:cursor-pointer file:transition
                             cursor-pointer border-2 border-dashed border-purple-400/30 rounded-lg p-3
                             hover:border-purple-400/50 transition"
                />
                
                <div className="mt-3 bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-300 mb-1">
                    📝 Formatos soportados:
                  </p>
                  <ul className="text-xs text-blue-200 space-y-1">
                    <li>• <strong>Excel (.xlsx, .xls):</strong> Columnas: Pregunta | Opción A | Opción B | Opción C | Correcta | Dificultad</li>
                    <li>• <strong>Texto (.txt):</strong> Formato: PREGUNTA: ... / A) ... / B) ... / C) ... / CORRECTA: A / ---</li>
                  </ul>
                </div>
              </div>

              {theme.questions && theme.questions.length > 0 && (
                <div className="mt-4 bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-sm text-gray-300">
                    📊 Total de preguntas: <strong className="text-purple-300">{theme.questions.length}</strong>
                  </p>
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

function ThemesScreen({ themes, onUpdateTheme, onNavigate, showToast, darkMode }) {
  const dm = darkMode;
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
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
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

function ExamConfigScreen({ themes, onStartExam, onNavigate, darkMode }) {
  const dm = darkMode;
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
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
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

function ExamScreen({ config, themes, onFinish, onNavigate, onUpdateThemes, darkMode }) {
  const dm = darkMode;
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
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-3 sm:p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
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

function StatsScreen({ examHistory, onNavigate, themes, darkMode }) {
  const dm = darkMode;
  const totalExams = examHistory.length;
  const avg = totalExams > 0 
    ? (examHistory.reduce((s, e) => s + parseFloat(e.percentage), 0) / totalExams).toFixed(1) 
    : 0;
  const totalQuestions = examHistory.reduce((s, e) => s + (e.numQuestions || 0), 0);
  const bestScore = totalExams > 0 ? Math.max(...examHistory.map(e => parseFloat(e.percentage))) : 0;
  const today = new Date().toDateString();
  const hasStudiedToday = examHistory.some(e => new Date(e.date).toDateString() === today);
  const level = Math.floor(totalQuestions / 100) + 1;
  const xpInLevel = totalQuestions % 100;

  const achievements = [
    { id: 'first_exam', name: 'Primer Paso', desc: 'Completa tu primer examen', icon: '🎯', unlocked: totalExams >= 1, progress: Math.min(totalExams * 100, 100) },
    { id: 'perfect_score', name: 'Perfección', desc: 'Saca un 100%', icon: '💯', unlocked: bestScore >= 100, progress: Math.min(bestScore, 100) },
    { id: 'questions_100', name: 'Centenario', desc: 'Responde 100 preguntas', icon: '📚', unlocked: totalQuestions >= 100, progress: Math.min((totalQuestions / 100) * 100, 100) },
    { id: 'questions_500', name: 'Experto', desc: 'Responde 500 preguntas', icon: '🎓', unlocked: totalQuestions >= 500, progress: Math.min((totalQuestions / 500) * 100, 100) },
  ];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - i * 86400000);
    const dateStr = date.toDateString();
    const examsDay = examHistory.filter(e => new Date(e.date).toDateString() === dateStr);
    return {
      date: date.toLocaleDateString('es-ES', { weekday: 'short' }),
      count: examsDay.length,
      avgScore: examsDay.length > 0 ? Math.round(examsDay.reduce((s, e) => s + parseFloat(e.percentage), 0) / examsDay.length) : 0
    };
  }).reverse();

  const cardClass = `rounded-2xl p-5 ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`;
  const maxBar = Math.max(...last7Days.map(d => d.count), 1);

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Estadísticas
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* NIVEL + XP */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide">Nivel de opositor</p>
              <p className="text-3xl font-black mt-0.5" style={{ fontFamily: 'Sora, system-ui' }}>Nivel {level}</p>
            </div>
            <span className="text-4xl">🎖️</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${(xpInLevel / 100) * 100}%` }} />
          </div>
          <p className="text-blue-200 text-xs mt-2">{xpInLevel}/100 XP → Nivel {level + 1}</p>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Media', value: `${avg}%`, color: '#2563EB', icon: '🎯' },
            { label: 'Mejor', value: `${bestScore.toFixed(0)}%`, color: '#10B981', icon: '🏆' },
            { label: 'Exámenes', value: totalExams, color: '#7C3AED', icon: '📝' },
            { label: 'Preguntas', value: totalQuestions, color: '#F59E0B', icon: '❓' },
          ].map((s, i) => (
            <div key={i} className={`${cardClass} text-center`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-2xl font-black" style={{ fontFamily: 'Sora, system-ui', color: s.color }}>{s.value}</div>
              <div className={`text-xs mt-0.5 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* RACHA */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Racha de estudio</p>
              <p className="text-2xl font-black mt-1" style={{ fontFamily: 'Sora, system-ui', color: '#F59E0B' }}>
                {hasStudiedToday ? '🔥 Activo' : '💤 Inactivo'}
              </p>
              <p className={`text-xs mt-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                {hasStudiedToday ? '¡Ya estudiaste hoy!' : 'Haz un examen para mantener la racha'}
              </p>
            </div>
            <span className="text-4xl">{hasStudiedToday ? '🔥' : '⏰'}</span>
          </div>
        </div>

        {/* ACTIVIDAD 7 DÍAS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-4 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Últimos 7 días
          </p>
          <div className="flex items-end gap-2 h-20">
            {last7Days.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-lg transition-all ${dm ? 'bg-[#1E293B]' : 'bg-slate-100'}`} style={{ height: '64px', position: 'relative' }}>
                  {day.count > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-lg"
                      style={{ height: `${(day.count / maxBar) * 100}%`, background: 'linear-gradient(to top, #2563EB, #7C3AED)' }} />
                  )}
                </div>
                <p className={`text-[10px] ${dm ? 'text-slate-600' : 'text-slate-400'}`}>{day.date}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LOGROS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Logros · {achievements.filter(a => a.unlocked).length}/{achievements.length}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div key={a.id} className={`p-3 rounded-xl border transition-all
                ${a.unlocked
                  ? dm ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                  : dm ? 'bg-[#1E293B] border-[#334155] opacity-50' : 'bg-slate-50 border-slate-200 opacity-50'
                }`}>
                <div className="text-2xl text-center mb-1">{a.icon}</div>
                <p className={`text-xs font-bold text-center ${a.unlocked ? 'text-amber-500' : dm ? 'text-slate-500' : 'text-slate-400'}`}>{a.name}</p>
                <p className={`text-[10px] text-center mt-0.5 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>{a.desc}</p>
                {!a.unlocked && (
                  <div className={`h-1 rounded-full mt-2 overflow-hidden ${dm ? 'bg-[#334155]' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full" style={{ width: `${a.progress}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HISTORIAL */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Historial reciente
          </p>
          {totalExams > 0 ? (
            <div className="space-y-2">
              {examHistory.slice(0, 8).map((e, i) => {
                const pct = parseFloat(e.percentage);
                const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl
                    ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className={`text-sm ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(e.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{e.numQuestions || 0} preg.</span>
                      <span className="font-bold text-sm" style={{ color }}>{e.percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📝</p>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Sin exámenes aún</p>
              <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>¡Haz tu primer examen!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function HeatmapScreen({ themes, onNavigate, darkMode }) {
  const dm = darkMode;
  const themeStats = themes.map(theme => {
    const questions = theme.questions || [];
    const total = questions.length;
    const attempted = questions.filter(q => q.attempts && q.attempts > 0).length;
    const errors = questions.reduce((sum, q) => sum + (q.errors || 0), 0);
    const attempts = questions.reduce((sum, q) => sum + (q.attempts || 0), 0);
    const errorRate = attempts > 0 ? (errors / attempts) * 100 : 0;
    return { number: theme.number, name: theme.name, total, attempted, errors, attempts, errorRate: Math.round(errorRate) };
  }).filter(t => t.attempts > 0);

  const sortedByError = [...themeStats].sort((a, b) => b.errorRate - a.errorRate);
  const top10Critical = sortedByError.slice(0, 10);

  const getHeatColor = (errorRate) => {
    if (errorRate >= 70) return { bg: '#EF4444', text: 'white' };
    if (errorRate >= 50) return { bg: '#F97316', text: 'white' };
    if (errorRate >= 30) return { bg: '#F59E0B', text: 'white' };
    if (errorRate >= 10) return { bg: '#10B981', text: 'white' };
    return { bg: '#2563EB', text: 'white' };
  };

  const cardClass = `rounded-2xl p-5 ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`;

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Mapa de Calor
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* GRID DE TEMAS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-4 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Vista general · {themes.length} temas
          </p>
          <div className="grid grid-cols-9 gap-1.5">
            {themes.map(theme => {
              const stat = themeStats.find(s => s.number === theme.number);
              const hasData = stat && stat.attempts > 0;
              const colors = hasData ? getHeatColor(stat.errorRate) : null;
              return (
                <div key={theme.number}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold transition-all hover:scale-110 active:scale-95 cursor-default`}
                  style={hasData ? { background: colors.bg, color: colors.text } : { background: dm ? '#1E293B' : '#E2E8F0', color: dm ? '#475569' : '#94A3B8' }}
                  title={`Tema ${theme.number}: ${theme.name}${hasData ? ` - ${stat.errorRate}% error` : ''}`}>
                  {theme.number}
                </div>
              );
            })}
          </div>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 mt-4">
            {[['#2563EB','Excelente'],['#10B981','Bien'],['#F59E0B','Medio'],['#F97316','Difícil'],['#EF4444','Crítico']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: c }} />
                <span className={`text-[10px] ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP 10 CRÍTICOS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            🔥 Top críticos
          </p>
          {top10Critical.length > 0 ? (
            <div className="space-y-2">
              {top10Critical.map((stat, idx) => {
                const colors = getHeatColor(stat.errorRate);
                return (
                  <div key={stat.number} className={`flex items-center gap-3 p-3 rounded-xl ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
                    <span className={`text-lg font-black w-7 text-center ${dm ? 'text-slate-600' : 'text-slate-300'}`}>#{idx+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
                        T{stat.number} · {stat.name}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                        {stat.errors}/{stat.attempts} errores
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ background: colors.bg }}>
                      {stat.errorRate}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📊</p>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Sin datos aún</p>
              <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>Completa exámenes para ver el mapa</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS SCREEN
// ============================================================================

function SettingsScreen({ onNavigate, darkMode, onToggleDark }) {
  const dm = darkMode;
  const [profile, setProfile] = useState({
    name: '',
    examName: '',
    numThemes: 90,
    penaltySystem: 'classic'
  });
  const [notifications, setNotifications] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cargar perfil sin bloquear - NO usa loading state
  useEffect(() => {
    (async () => {
      try {
        const p = await storage.get('user-profile');
        if (p) {
          setProfile(p);
          setNotifications(p.notifications || false);
        }
      } catch (e) {
        // En modo demo, storage puede fallar - continuar con defaults
        console.log('Settings: usando valores por defecto');
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      const updatedProfile = { ...profile, darkMode: dm, notifications };
      await storage.set('user-profile', updatedProfile);
    } catch (e) {
      console.log('Settings: no se pudo guardar en storage');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all
    ${dm
      ? 'bg-[#1E293B] border border-[#334155] text-slate-100 focus:border-blue-500'
      : 'bg-[#F8FAFF] border border-slate-200 text-slate-800 focus:border-blue-500'
    }`;

  const cardClass = `rounded-2xl p-5 space-y-4
    ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`;

  const labelClass = `text-xs font-semibold uppercase tracking-wide mb-1.5 block
    ${dm ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
              ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <div>
            <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>
              Ajustes
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* PERFIL */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">👤</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Perfil</h2>
          </div>

          <div>
            <label className={labelClass}>Nombre</label>
            <input type="text" value={profile.name || ''} placeholder="Tu nombre"
              onChange={(e) => setProfile({...profile, name: e.target.value})}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Oposición</label>
            <input type="text" value={profile.examName || ''} placeholder="Ej: Guardia Civil, Administrativo..."
              onChange={(e) => setProfile({...profile, examName: e.target.value})}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Número de temas</label>
            <input type="number" min="1" max="200" value={profile.numThemes || 90}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= 200) setProfile({...profile, numThemes: v});
              }}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Sistema de penalización</label>
            <select value={profile.penaltySystem || 'classic'}
              onChange={(e) => setProfile({...profile, penaltySystem: e.target.value})}
              className={inputClass}>
              <option value="classic" className="bg-slate-800 text-white">Clásico: 3 incorrectas = -1</option>
              <option value="each2" className="bg-slate-800 text-white">Estricto: 2 incorrectas = -1</option>
              <option value="each4" className="bg-slate-800 text-white">Permisivo: 4 incorrectas = -1</option>
              <option value="none" className="bg-slate-800 text-white">Sin penalización</option>
            </select>
          </div>
        </div>

        {/* APARIENCIA */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎨</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Apariencia</h2>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl
            ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Modo oscuro</p>
              <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Reduce la fatiga visual</p>
            </div>
            <button onClick={onToggleDark}
              className={`relative w-12 h-6 rounded-full transition-all duration-300
                ${dm ? 'bg-blue-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
                ${dm ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* NOTIFICACIONES */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔔</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Notificaciones</h2>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl
            ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Recordatorio diario</p>
              <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Recordatorio a las 20:00h</p>
            </div>
            <button onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300
                ${notifications ? 'bg-green-500' : dm ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
                ${notifications ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* INFO */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💡</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Sobre PasaElTest</h2>
          </div>
          <div className="space-y-2">
            {[
              ['Versión', '2.3 Redesign'],
              ['Generación', 'Análisis inteligente Fase 2'],
              ['Almacenamiento', 'Nube (Supabase)'],
              ['IA', 'Gemini 2.0 Flash'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{k}</span>
                <span className={`text-xs font-semibold ${dm ? 'text-slate-300' : 'text-slate-600'}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GUARDAR */}
        <button onClick={handleSave}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-all active:scale-[0.98]"
          style={{ 
            background: saved 
              ? '#10B981'
              : 'linear-gradient(135deg, #2563EB, #7C3AED)',
            boxShadow: '0 4px 20px rgba(37,99,235,0.3)',
            fontFamily: 'Sora, system-ui'
          }}>
          {saved ? '✅ ¡Guardado!' : '💾 Guardar cambios'}
        </button>

      </div>
    </div>
  );
}

// ============================================================================
// BOTTOM NAV
// ============================================================================

function BottomNav({ current, onNavigate, darkMode }) {
  const items = [
    { id: 'home', icon: Icons.Home, label: 'Inicio' },
    { id: 'themes', icon: Icons.Book, label: 'Temas' },
    { id: 'heatmap', icon: Icons.Fire, label: 'Mapa' },
    { id: 'stats', icon: Icons.Stats, label: 'Stats' }
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[9999] h-[72px]
      ${darkMode
        ? 'bg-[#0F172A]/95 border-t border-[#1E293B]'
        : 'bg-white/95 border-t border-slate-200/80'
      } backdrop-blur-xl`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around items-center h-full max-w-lg mx-auto px-2">
        {items.map(item => {
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl min-w-[64px] transition-all duration-200 active:scale-90
                ${isActive
                  ? 'text-white'
                  : darkMode ? 'text-slate-600' : 'text-slate-400'
                }`}
              style={isActive ? {
                background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
              } : {}}
            >
              <item.icon />
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
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
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true'; } catch { return false; }
  });
  
  // Aplicar darkMode globalmente
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try { localStorage.setItem('darkMode', darkMode); } catch {}
  }, [darkMode]);

  const dm = darkMode;
  
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
      setLoading(false); // Reset loading
    } catch (error) {
      console.error('Error logging out:', error);
      // Forzar logout local incluso si falla en Supabase
      setCurrentUser(null);
      setIsAuthenticated(false);
      setThemes([]);
      setExamHistory([]);
      setProfile(null);
      setScreen('home');
      setLoading(false); // Reset loading
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
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="text-center">
          <div className="text-4xl font-bold animate-pulse" style={{ fontFamily: 'Sora, system-ui', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PasaElTest
          </div>
          <p className={`mt-2 text-sm ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Verificando sesión...</p>
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
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'Sora, system-ui' }}>P</span>
          </div>
          <div className="text-2xl font-bold" style={{ fontFamily: 'Sora, system-ui', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PasaElTest
          </div>
          <div className="mt-4 flex gap-1 justify-center">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: '#2563EB', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dm ? 'dark-mode' : ''}>
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
          darkMode={dm}
        />
      )}
      
      {screen === 'home' && (
        <HomeScreen 
          onNavigate={setScreen} 
          stats={stats} 
          profile={profile}
          user={currentUser}
          onShowProfile={() => setShowUserProfile(true)}
          darkMode={dm}
        />
      )}
      {screen === 'themes' && <ThemesScreen themes={themes} onUpdateTheme={updateTheme} onNavigate={setScreen} showToast={showToast} darkMode={dm} />}
      {screen === 'exam' && <ExamConfigScreen themes={themes} onStartExam={startExam} onNavigate={setScreen} darkMode={dm} />}
      {screen === 'exam-active' && (
        <ExamScreen 
          config={examConfig} 
          themes={themes} 
          onFinish={finishExam} 
          onNavigate={setScreen} 
          onUpdateThemes={updateTheme}
          darkMode={dm}
        />
      )}
      {screen === 'stats' && <StatsScreen examHistory={examHistory} onNavigate={setScreen} themes={themes} darkMode={dm} />}
      {screen === 'heatmap' && <HeatmapScreen themes={themes} onNavigate={setScreen} darkMode={dm} />}
      {screen === 'settings' && <SettingsScreen onNavigate={setScreen} darkMode={dm} onToggleDark={() => setDarkMode(!dm)} />}
      <BottomNav current={screen} onNavigate={setScreen} darkMode={dm} />
    </div>
  );
}
