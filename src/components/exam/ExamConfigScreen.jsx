import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function ExamConfigScreen({ themes, onStartExam, onNavigate }) {
  const { dm, cx } = useTheme();
  const [numQuestions, setNumQuestions] = useState(20);
  const [failedRatio, setFailedRatio] = useState(0);
  const [penaltySystem, setPenaltySystem] = useState('classic');
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [selectedThemes, setSelectedThemes] = useState([]);

  const toggleTheme = (num) => {
    setSelectedThemes(prev =>
      prev.includes(num) ? prev.filter(t => t !== num) : [...prev, num]
    );
  };

  const totalAvailable = themes
    .filter(t => selectedThemes.includes(t.number))
    .reduce((sum, t) => sum + (t.questions?.length || 0), 0);

  const totalFailed = themes
    .filter(t => selectedThemes.includes(t.number))
    .reduce((sum, t) => sum + (t.questions?.filter(q => q.errors_count > 0).length || 0), 0);

  const estimatedFailed = Math.min(Math.round((failedRatio / 100) * numQuestions), totalFailed);
  const effectiveNum = Math.min(numQuestions, totalAvailable);
  const canStart = selectedThemes.length > 0 && totalAvailable > 0;

  const penaltyOptions = [
    { value: 'none',    label: 'Sin penalización' },
    { value: 'each4',   label: '4 incorrectas = -1 punto' },
    { value: 'classic', label: '3 incorrectas = -1 punto' },
    { value: 'each2',   label: '2 incorrectas = -1 punto' },
    { value: 'each1',   label: '1 incorrecta = -1 punto' },
  ];

  const inputCls = `flex-1 text-center rounded-xl px-4 py-3 font-bold text-xl ${dm ? 'bg-white/5 text-white border border-white/10' : 'bg-slate-50 text-slate-800 border border-slate-200'}`;
  const btnCls = `w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center ${dm ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
  const cardCls = `rounded-2xl p-6 ${cx.card}`;
  const labelCls = `text-sm font-semibold block mb-3 ${cx.body}`;

  return (
    <div className={`min-h-full ${cx.screen} p-4 transition-colors`} style={{ paddingTop: 'var(--pt-header)', paddingBottom: 'var(--pb-screen)' }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className={`p-2 rounded-xl ${dm ? 'bg-white/5 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-2xl ${cx.heading}`}>Configurar Examen</h1>
        </div>

        {/* Número de preguntas */}
        <div className={cardCls}>
          <label className={labelCls}>Número de preguntas</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setNumQuestions(n => Math.max(1, n - 5))} className={btnCls}>−</button>
            <input
              type="number"
              min={1}
              max={999}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputCls}
            />
            <button onClick={() => setNumQuestions(n => n + 5)} className={btnCls}>+</button>
          </div>
          {totalAvailable > 0 && (
            <p className={`text-xs mt-2 text-center ${cx.muted}`}>
              {totalAvailable} disponibles
              {numQuestions > totalAvailable && (
                <span className="text-amber-500 ml-1">· Se usarán todas ({totalAvailable})</span>
              )}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {[10, 20, 30, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => setNumQuestions(n)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  numQuestions === n
                    ? 'bg-blue-500 text-white'
                    : dm ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>

        {/* Preguntas falladas */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-1">
            <label className={`text-sm font-semibold ${cx.body}`}>Preguntas falladas</label>
            <span className={`text-sm font-bold ${failedRatio > 0 ? 'text-orange-500' : dm ? 'text-gray-400' : 'text-slate-400'}`}>
              {failedRatio}%
            </span>
          </div>
          <p className={`text-xs mb-3 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
            Porcentaje del examen con preguntas que has fallado antes
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={failedRatio}
            onChange={(e) => setFailedRatio(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs mt-1">
            <span className={dm ? 'text-gray-500' : 'text-slate-400'}>Aleatorio</span>
            <span className={dm ? 'text-gray-500' : 'text-slate-400'}>Solo falladas</span>
          </div>
          {failedRatio > 0 && selectedThemes.length > 0 && (
            <p className={`text-xs mt-2 ${dm ? 'text-orange-400' : 'text-orange-600'}`}>
              ~{estimatedFailed} preguntas falladas · {totalFailed} disponibles en temas seleccionados
            </p>
          )}
        </div>

        {/* Penalización */}
        <div className={cardCls}>
          <label className={labelCls}>Penalización por fallo</label>
          <div className="grid grid-cols-1 gap-2">
            {penaltyOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPenaltySystem(opt.value)}
                className={`py-2.5 px-4 rounded-xl text-sm font-medium text-left transition-colors ${
                  penaltySystem === opt.value
                    ? 'bg-blue-500 text-white'
                    : dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tiempo límite */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={`text-sm font-semibold ${cx.body}`}>Tiempo límite</p>
              <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>El examen termina automáticamente</p>
            </div>
            <button
              onClick={() => setTimeLimitEnabled(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative ${timeLimitEnabled ? 'bg-blue-500' : dm ? 'bg-white/20' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${timeLimitEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {timeLimitEnabled && (
            <div className="flex items-center gap-3">
              <button onClick={() => setTimeLimitMinutes(m => Math.max(1, m - 5))} className={btnCls}>−</button>
              <input
                type="number"
                min={1}
                max={999}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
              <span className={`text-sm font-medium ${cx.muted}`}>min</span>
              <button onClick={() => setTimeLimitMinutes(m => m + 5)} className={btnCls}>+</button>
            </div>
          )}
        </div>

        {/* Seleccionar Temas */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${cx.card}`}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`font-semibold text-sm sm:text-base ${cx.heading}`}>Seleccionar Temas</h3>
            <span className={`text-xs sm:text-sm ${cx.muted}`}>{selectedThemes.length} seleccionados</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSelectedThemes(themes.map(t => t.number))}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${dm ? 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700'}`}
            >✓ Todos ({themes.length})</button>
            <button
              onClick={() => setSelectedThemes(themes.filter(t => t.questions?.length > 0).map(t => t.number))}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${dm ? 'bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300' : 'bg-green-50 hover:bg-green-100 border border-green-200 text-green-700'}`}
            >✓ Con preguntas ({themes.filter(t => t.questions?.length > 0).length})</button>
            <button
              onClick={() => {
                const withQuestions = themes.filter(t => t.questions?.length > 0);
                const random = withQuestions.sort(() => Math.random() - 0.5).slice(0, 10);
                setSelectedThemes(random.map(t => t.number));
              }}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${dm ? 'bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300' : 'bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-700'}`}
            >🎲 Aleatorio (10)</button>
            <button
              onClick={() => setSelectedThemes([])}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${dm ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300' : 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'}`}
            >✕ Limpiar</button>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {themes.map(t => (
              <button
                key={t.number}
                onClick={() => toggleTheme(t.number)}
                className={`aspect-square rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm relative transition-all active:scale-95 ${
                  selectedThemes.includes(t.number)
                    ? 'bg-blue-500 text-white scale-105 shadow-md'
                    : dm ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

        {/* Hint de validación */}
        {!canStart && (
          <div className={`rounded-xl p-3 flex items-start gap-2 text-sm ${
            dm ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            <span className="mt-0.5">👆</span>
            <span>
              {selectedThemes.length === 0
                ? 'Selecciona al menos un tema de la lista de abajo para comenzar.'
                : 'Los temas seleccionados no tienen preguntas. Ve a Temas → IA para generarlas.'}
            </span>
          </div>
        )}

        {/* Botón comenzar */}
        <button
          onClick={() => onStartExam({
            numQuestions,
            selectedThemes,
            failedRatio,
            penaltySystem,
            timeLimitMinutes: timeLimitEnabled ? timeLimitMinutes : null,
          })}
          disabled={!canStart}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 sm:py-4 rounded-xl sm:rounded-2xl disabled:opacity-50 transition-all text-sm sm:text-base shadow-md"
        >
          {totalAvailable === 0 && selectedThemes.length > 0
            ? 'No hay preguntas en temas seleccionados'
            : selectedThemes.length === 0
            ? 'Selecciona al menos un tema'
            : `Comenzar · ${effectiveNum || numQuestions} preguntas${timeLimitEnabled ? ` · ${timeLimitMinutes} min` : ''}`}
        </button>
      </div>
    </div>
  );
}

export default ExamConfigScreen;
