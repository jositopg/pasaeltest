import React, { useState } from 'react';
import { authHelpers } from '../../supabaseClient';
import { GRADIENT_BG, GRADIENT_STYLE } from '../../utils/constants';

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

export default AuthScreen;
