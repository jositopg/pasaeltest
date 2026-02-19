import React, { useState } from 'react';
import Icons from '../common/Icons';
import ThemeDetailModal from './ThemeDetailModal';
import { GRADIENT_BG } from '../../utils/constants';

function ThemesScreen({ themes, onUpdateTheme, onNavigate, showToast, darkMode }) {
  const dm = darkMode;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  const handleUpdateTheme = (updatedTheme) => {
    onUpdateTheme(updatedTheme);
    const wasOpen = selectedTheme !== null;
    if (wasOpen && selectedTheme.number === updatedTheme.number) {
      setSelectedTheme(null);
      setTimeout(() => {
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
    
    updates.forEach(theme => onUpdateTheme(theme));
    setShowBulkImport(false);
    setBulkText('');
  };

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('home')} 
            className={`p-2 rounded-xl ${dm ? 'bg-white/5 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-2xl flex-1 ${dm ? 'text-white' : 'text-slate-800'}`}>Temas</h1>
          <button 
            onClick={() => setShowBulkImport(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Icons.Plus />
            Importar Nombres
          </button>
        </div>
        
        {/* Search */}
        <div className={`rounded-2xl p-4 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white shadow-sm border border-slate-200'}`}>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className={`w-full rounded-xl px-4 py-3 pl-12 ${
                dm 
                  ? 'bg-white/5 text-white border border-white/10 placeholder-gray-500' 
                  : 'bg-slate-50 text-slate-800 border border-slate-200 placeholder-slate-400'
              }`} 
            />
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-400' : 'text-slate-400'}`}>
              <Icons.Search />
            </div>
          </div>
        </div>
        
        {/* Theme list */}
        <div className="space-y-2">
          {filteredThemes.map(theme => {
            const questionCount = theme.questions?.length || 0;
            const progressPercent = Math.min((questionCount / 50) * 100, 100);
            const hasDocuments = theme.documents?.length > 0;
            
            return (
              <div 
                key={theme.number} 
                onClick={() => setSelectedTheme(theme)} 
                className={`rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
                  dm 
                    ? 'bg-white/5 border border-white/10 hover:bg-white/10' 
                    : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex-1">
                    <h3 className={`font-semibold text-sm sm:text-base ${dm ? 'text-white' : 'text-slate-800'}`}>
                      Tema {theme.number}
                    </h3>
                    <p className={`text-xs sm:text-sm mt-1 line-clamp-1 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                      {theme.name}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                      questionCount >= 50 
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' 
                        : questionCount >= 25 
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                          : questionCount > 0 
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                            : dm 
                              ? 'bg-gray-500/20 text-gray-400' 
                              : 'bg-slate-100 text-slate-500'
                    }`}>
                      {questionCount} pregunta{questionCount !== 1 ? 's' : ''}
                    </span>
                    {hasDocuments && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        dm ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {theme.documents.length} doc{theme.documents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent >= 50 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                      progressPercent >= 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                      progressPercent > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                      dm ? 'bg-gray-600' : 'bg-slate-200'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                
                {questionCount === 0 && !hasDocuments && (
                  <p className={`text-xs mt-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>Sin contenido añadido</p>
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

        {/* Bulk import modal */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`border rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto ${
              dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className={`sticky top-0 p-6 border-b flex items-center justify-between ${
                dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <h2 className={`font-bold text-xl ${dm ? 'text-white' : 'text-slate-800'}`}>Importar Nombres de Temas</h2>
                  <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>Pega la lista completa de tus temas</p>
                </div>
                <button 
                  onClick={() => setShowBulkImport(false)} 
                  className={`p-2 rounded-xl ${dm ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  <Icons.X />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className={`border rounded-xl p-4 ${dm ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                  <h3 className="text-blue-600 dark:text-blue-400 font-semibold text-sm mb-2">📝 Formatos aceptados:</h3>
                  <div className={`text-xs space-y-1 font-mono ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                    <div>1. Constitución Española</div>
                    <div>Tema 2: Derechos Fundamentales</div>
                    <div>3, Organización Territorial</div>
                    <div>4 | Estatuto de Autonomía</div>
                  </div>
                </div>

                <div>
                  <label className={`text-sm mb-2 block font-semibold ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
                    Pega aquí tu lista (un tema por línea):
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="1. Constitución Española&#10;2. Derechos Fundamentales&#10;3. Organización Territorial&#10;..."
                    className={`w-full rounded-xl px-4 py-3 font-mono text-sm min-h-[300px] resize-vertical ${
                      dm 
                        ? 'bg-white/5 text-white border border-white/10' 
                        : 'bg-slate-50 text-slate-800 border border-slate-200'
                    }`}
                  />
                  <p className={`text-xs mt-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                    {bulkText.split('\n').filter(l => l.trim()).length} líneas detectadas
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowBulkImport(false);
                      setBulkText('');
                    }}
                    className={`flex-1 font-semibold py-3 rounded-xl ${
                      dm ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={!bulkText.trim()}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors"
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


export default ThemesScreen;
