import React from 'react';

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
  const reasonText = {
    plan: 'Para crear tus propios planes necesitas una suscripción.',
    academy: 'Para compartir planes con alumnos necesitas el plan Academia.',
  }[reason] || 'Desbloquea todas las funciones con una suscripción.';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, system-ui' }}>
            Desbloquea esta función
          </h2>
          <p className="text-slate-400 text-sm mt-2">{reasonText}</p>
        </div>

        {/* Plans */}
        <div className="px-4 pb-2 space-y-3">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`rounded-2xl p-4 border ${
                plan.highlight
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{plan.icon}</span>
                  <div>
                    <p className={`font-bold text-sm ${plan.highlight ? 'text-blue-300' : 'text-white'}`}>
                      {plan.name}
                    </p>
                    <p className="text-slate-500 text-xs">{plan.description}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold shrink-0 ml-2 ${plan.highlight ? 'text-blue-400' : 'text-slate-300'}`}>
                  {plan.price}
                </span>
              </div>
              <ul className="space-y-1 mb-3">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-green-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => window.open('mailto:hola@pasaeltest.com?subject=Suscripción ' + plan.name, '_blank')}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  plan.highlight
                    ? 'text-white'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
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
            className="w-full py-3 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
