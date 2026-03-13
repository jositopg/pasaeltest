import React, { useState } from 'react';
import { authHelpers } from '../../supabaseClient';

function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuestMode = () => {
    onLogin({
      id: `guest-${Date.now()}`,
      email: 'guest@temp.com',
      name: 'Invitado',
      createdAt: new Date().toISOString(),
      subscription: 'free',
      isGuest: true,
      isFirstLogin: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && !formData.role) {
      setError('Selecciona si eres academia/profesor o alumno.');
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      setError('La conexión tardó demasiado. Comprueba tu internet e inténtalo de nuevo.');
    }, 10000);

    try {
      if (isLogin) {
        const { data, error } = await authHelpers.signIn(formData.email, formData.password);
        clearTimeout(timeout);

        if (error) {
          setError(
            error.message === 'Invalid login credentials'
              ? 'Email o contraseña incorrectos'
              : error.message?.toLowerCase().includes('email not confirmed')
              ? 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.'
              : error.message || 'Error al iniciar sesión'
          );
          setLoading(false);
          return;
        }

        onLogin({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || 'Usuario',
          createdAt: data.user.created_at,
          subscription: 'free',
          isGuest: false,
          isFirstLogin: false,
        });

      } else {
        const { data, error } = await authHelpers.signUp(
          formData.email,
          formData.password,
          { name: formData.name, role: formData.role }
        );
        clearTimeout(timeout);

        if (error) {
          setError(
            error.message === 'User already registered'
              ? 'Este email ya está registrado'
              : 'Error al crear la cuenta'
          );
          setLoading(false);
          return;
        }

        onLogin({
          id: data.user.id,
          email: data.user.email,
          name: formData.name,
          role: formData.role,
          createdAt: data.user.created_at,
          subscription: 'free',
          isGuest: false,
          isFirstLogin: true,
        });
      }

      setLoading(false);
    } catch (err) {
      clearTimeout(timeout);
      setError('Error al procesar la solicitud');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5"
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
        <p className="text-slate-500 text-sm mt-1">Practica. Aprende. Aprueba.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#0F172A] border border-[#1E293B] rounded-3xl p-6 shadow-2xl animate-fade-in-up">

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl bg-[#080C14]">
          {[['login', 'Entrar'], ['register', 'Registrarse']].map(([mode, label]) => (
            <button key={mode}
              onClick={() => { setIsLogin(mode === 'login'); setError(''); }}
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

          {/* Nombre (solo registro) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                Nombre
              </label>
              <input type="text" required value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tu nombre o nombre de la academia"
                className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
            </div>
          )}

          {/* Selector de rol (solo registro) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">
                ¿Cómo vas a usar PasaElTest?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'academy', icon: '🎓', title: 'Academia', subtitle: 'o Profesor' },
                  { value: 'student', icon: '📖', title: 'Alumno', subtitle: 'de una academia' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: opt.value })}
                    className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border text-center transition-all ${
                      formData.role === opt.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#334155] bg-[#1E293B] hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <span className={`text-sm font-bold ${formData.role === opt.value ? 'text-blue-400' : 'text-slate-300'}`}>
                      {opt.title}
                    </span>
                    <span className="text-[10px] text-slate-500">{opt.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Email</label>
            <input type="email" required value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="tu@email.com"
              className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Contraseña</label>
            <input type="password" required value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
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
            {loading ? '⏳ Procesando...' : (isLogin ? 'Entrar →' : 'Crear cuenta →')}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[#1E293B]" />
          <span className="text-xs text-slate-600">o</span>
          <div className="flex-1 h-px bg-[#1E293B]" />
        </div>

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
