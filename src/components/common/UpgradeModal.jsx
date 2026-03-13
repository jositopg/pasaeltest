import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const PLANS = [
  {
    id: 'student',
    icon: '📖',
    name: 'Estudiante',
    price: '4,99€/mes',
    description: 'Para quien quiere prepararse por su cuenta',
    features: [
      'Planes de estudio ilimitados',
      'Generación de preguntas con IA',
      'Repaso inteligente (SRS)',
      'Historial y estadísticas',
    ],
    cta: 'Empezar gratis 7 días',
    highlight: false,
  },
  {
    id: 'academy',
    icon: '🎓',
    name: 'Academia',
    price: '19,99€/mes',
    description: 'Para academias y profesores que comparten contenido',
    features: [
      'Todo lo del plan Estudiante',
      'Planes compartibles con alumnos',
      'Enlace de invitación por plan',
      'Hasta 200 alumnos por plan',
      'Soporte prioritario',
    ],
    cta: 'Contactar con ventas',
    highlight: true,
  },
];

export default function UpgradeModal({ onClose, reason = 'plan' }) {
  const { dm } = useTheme();

  const reasonText = {
    plan: 'Para crear tus propios planes necesitas una suscripción.',
    academy: 'Para compartir planes con alumnos necesitas el plan Academia.',
  }[reason] || 'Desbloquea todas las funciones con una suscripción.';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up border ${
        dm ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
      }`}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h2 className={`text-xl font-bold ${dm ? 'text-white' : 'text-slate-800'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Desbloquea esta función
          </h2>
          <p className={`text-sm mt-2 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{reasonText}</p>
        </div>

        {/* Plans */}
        <div className="px-4 pb-2 space-y-3">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`rounded-2xl p-4 border ${
                plan.highlight
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : dm ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{plan.icon}</span>
                  <div>
                    <p className={`font-bold text-sm ${plan.highlight ? 'text-blue-400' : dm ? 'text-white' : 'text-slate-800'}`}>
                      {plan.name}
                    </p>
                    <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{plan.description}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold shrink-0 ml-2 ${plan.highlight ? 'text-blue-400' : dm ? 'text-slate-300' : 'text-slate-700'}`}>
                  {plan.price}
                </span>
              </div>
              <ul className="space-y-1 mb-3">
                {plan.features.map((f, i) => (
                  <li key={i} className={`flex items-center gap-2 text-xs ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => window.open('mailto:hola@pasaeltest.com?subject=Suscripción ' + plan.name, '_blank')}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  plan.highlight
                    ? 'text-white'
                    : dm ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
                style={plan.highlight ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)' } : {}}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4">
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl text-sm transition-colors ${dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
