import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function JoinPlanScreen({ slug, currentUser, onSuccess, onCancel, onGoToLogin }) {
  const [planInfo, setPlanInfo] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | joining | alreadyJoined | error | notFound
  const [alreadyTestId, setAlreadyTestId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/get-plan?slug=${encodeURIComponent(slug)}`);
        if (res.status === 404) { setStatus('notFound'); return; }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        setPlanInfo(data);
        setStatus('ready');
      } catch (e) {
        setErrorMsg(e.message);
        setStatus('error');
      }
    }
    fetchPlan();
  }, [slug]);

  async function handleJoin() {
    setStatus('joining');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg('Necesitas iniciar sesión con una cuenta real para unirte a un plan. Los planes no están disponibles en modo prueba.');
        setStatus('error');
        return;
      }
      const res = await fetch('/api/clone-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ slug }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setAlreadyTestId(data.testId);
        setStatus('alreadyJoined');
        return;
      }

      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      onSuccess(data.testId);
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {status === 'loading' && (
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Cargando plan...</p>
          </div>
        )}

        {status === 'notFound' && (
          <div className="text-center space-y-6">
            <div className="text-5xl">❌</div>
            <div>
              <h2 className="text-white font-bold text-xl mb-2">Enlace inválido</h2>
              <p className="text-gray-400 text-sm">Este plan no existe o ha sido eliminado.</p>
            </div>
            <button
              onClick={onCancel}
              className="w-full py-3.5 rounded-2xl bg-white/10 text-white font-semibold"
            >
              Ir a la app
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-6">
            <div className="text-5xl">⚠️</div>
            <div>
              <h2 className="text-white font-bold text-xl mb-2">Error</h2>
              <p className="text-gray-400 text-sm">{errorMsg}</p>
            </div>
            {!currentUser?.isGuest && (
              <button
                onClick={onCancel}
                className="w-full py-3.5 rounded-2xl bg-white/10 text-white font-semibold"
              >
                Ir a la app
              </button>
            )}
            {currentUser?.isGuest && onGoToLogin && (
              <button
                onClick={onGoToLogin}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold"
              >
                Crear cuenta gratis
              </button>
            )}
            {currentUser?.isGuest && (
              <button
                onClick={onCancel}
                className="w-full py-3 text-gray-500 text-sm"
              >
                Continuar en modo prueba
              </button>
            )}
          </div>
        )}

        {status === 'alreadyJoined' && (
          <div className="text-center space-y-6">
            <div className="text-5xl">{planInfo?.cover_emoji || '📋'}</div>
            <div>
              <h2 className="text-white font-bold text-xl mb-2">Ya tienes este plan</h2>
              <p className="text-gray-400 text-sm">Este plan ya está en tu colección de tests.</p>
            </div>
            <button
              onClick={() => onSuccess(alreadyTestId)}
              className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-semibold"
            >
              Ir a mis temas
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 text-gray-500 text-sm"
            >
              Cancelar
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'joining') && planInfo && (
          <div className="space-y-6">
            {/* Plan card */}
            <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-6 text-center space-y-3">
              <div className="text-6xl">{planInfo.cover_emoji}</div>
              <h2 className="text-white font-bold text-2xl leading-tight">{planInfo.name}</h2>
              {planInfo.description && (
                <p className="text-gray-400 text-sm leading-relaxed">{planInfo.description}</p>
              )}
              <div className="flex justify-center gap-4 pt-2">
                <span className="flex items-center gap-1.5 text-sm text-gray-300">
                  <span>📚</span>
                  <span>{planInfo.totalThemes} temas</span>
                </span>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1.5 text-sm text-gray-300">
                  <span>❓</span>
                  <span>{planInfo.totalQuestions} preguntas</span>
                </span>
              </div>
            </div>

            {/* Hola usuario */}
            {currentUser?.email && (
              <p className="text-center text-xs text-gray-600">
                Uniéndote como <span className="text-gray-400">{currentUser.email}</span>
              </p>
            )}

            {/* Botones */}
            <div className="space-y-3">
              <button
                onClick={handleJoin}
                disabled={status === 'joining'}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {status === 'joining' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Clonando plan...
                  </>
                ) : (
                  '🚀 Unirme al plan'
                )}
              </button>

              <button
                onClick={onCancel}
                disabled={status === 'joining'}
                className="w-full py-3 rounded-2xl bg-white/5 text-gray-400 font-medium text-sm disabled:opacity-40"
              >
                No, gracias
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
