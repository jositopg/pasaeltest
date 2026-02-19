import React, { useState } from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';

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


export default ExamConfigScreen;
