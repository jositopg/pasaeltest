import React, { useState } from 'react';
import { authHelpers } from '../../supabaseClient';

function AuthScreen({ onLogin }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      setError('La conexión tardó demasiado. Comprueba tu internet e inténtalo de nuevo.');
    }, 10000);

    try {
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
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}>
          <svg viewBox="0 0 512 512" className="w-9 h-9" fill="white">
            <path d="M 295 72 L 172 265 L 245 265 L 172 440 L 348 248 L 272 248 Z" />
          </svg>
        </div>
        <h1 className="text-4xl font-black" style={{ fontFamily: 'Sora, system-ui', background: 'linear-gradient(135deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PasaElTest
        </h1>
        <p className="text-slate-500 text-sm mt-1">Practica. Aprende. Aprueba.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#0F172A] border border-[#1E293B] rounded-3xl p-6 shadow-2xl animate-fade-in-up">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Email</label>
            <input id="email" name="email" type="email" required autoFocus value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="tu@email.com"
              autoComplete="email"
              className="w-full bg-[#1E293B] border border-[#334155] text-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Contraseña</label>
            <input id="password" name="password" type="password" required value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              autoComplete="current-password"
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
            {loading ? '⏳ Entrando...' : 'Entrar →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthScreen;
