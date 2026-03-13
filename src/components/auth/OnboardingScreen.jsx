import React, { useState } from 'react';

const STEPS_ACADEMY = [
  {
    icon: '🎓',
    title: '¡Bienvenido, academia!',
    description: 'Con PasaElTest puedes crear planes de estudio con preguntas tipo test y compartirlos con tus alumnos en segundos.',
  },
  {
    icon: '📋',
    title: 'Crea tu plan de estudio',
    description: 'Un plan agrupa todos los temas de tu curso. La IA genera preguntas a partir de tus apuntes, PDFs o enlaces.',
    points: [
      '📄 Sube PDFs, pega texto o añade URLs',
      '🤖 La IA crea las preguntas por ti',
      '♾️ Tantos temas como necesites',
    ],
  },
  {
    icon: '🔗',
    title: 'Comparte con tus alumnos',
    description: 'Genera un enlace de invitación para tu plan. Tus alumnos se registran y acceden directamente a tu contenido.',
    points: [
      '📨 Un enlace único por plan',
      '👥 Tus alumnos lo usan desde su móvil',
      '🔒 Solo acceden al contenido que tú creas',
    ],
  },
];

const STEPS_STUDENT = [
  {
    icon: '👋',
    title: '¡Bienvenido a PasaElTest!',
    description: 'La app de práctica con preguntas tipo test. Estudia a tu ritmo, tanto si te prepara una academia como si lo haces por tu cuenta.',
  },
  {
    icon: '📚',
    title: 'Accede a tu contenido',
    description: 'Puedes unirte al plan de tu academia con su enlace de invitación, o crear tus propios planes de estudio.',
    points: [
      '🔗 Enlace de tu academia → acceso directo a su temario',
      '✏️ O crea tu propio plan con tus apuntes',
      '🤖 La IA genera preguntas por ti en segundos',
    ],
  },
  {
    icon: '🎯',
    title: 'Practica y mejora',
    description: 'Haz tests, repasa los fallos y sigue tu progreso. Cuanto más practiques, más subirá tu nota.',
    points: [
      '📝 Tests con las preguntas de tu temario',
      '🧠 Repaso inteligente de lo que más fallas',
      '📊 Ve tu evolución en cada tema',
    ],
  },
];

function OnboardingScreen({ user, onComplete }) {
  const [step, setStep] = useState(0);

  const isAcademy = user?.role === 'academy' || user?.user_metadata?.role === 'academy';
  const steps = isAcademy ? STEPS_ACADEMY : STEPS_STUDENT;

  const handleComplete = () => {
    onComplete({
      name: user.name,
      darkMode: false,
      notifications: false,
    });
  };

  const isLast = step === steps.length - 1;
  const s = steps[step];

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>
      <div className="w-full max-w-md">

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-blue-500' : i < step ? 'w-4 bg-blue-500/50' : 'w-4 bg-white/10'
            }`} />
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-8 space-y-6">

          <div className="text-center space-y-3">
            <div className="text-6xl">{s.icon}</div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Sora, system-ui' }}>
              {s.title}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">{s.description}</p>
          </div>

          {s.points && (
            <div className="space-y-2.5">
              {s.points.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-200">{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* Guest warning on last step */}
          {user?.isGuest && isLast && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center space-y-1">
              <p className="text-amber-400 text-sm font-semibold">⚠️ Modo prueba</p>
              <p className="text-amber-300/70 text-xs">Los datos no se guardan al cerrar la app. Crea una cuenta gratis para guardar tu progreso.</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium"
              >
                Atrás
              </button>
            )}
            <button
              onClick={() => isLast ? handleComplete() : setStep(step + 1)}
              className="flex-1 py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
            >
              {isLast ? '¡Empezar!' : 'Siguiente →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default OnboardingScreen;
