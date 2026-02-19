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
  
  // Wrapper para actualizar tanto el tema global como el selectedTheme
  const handleUpdateTheme = (updatedTheme) => {
    console.log('🔄 handleUpdateTheme llamado');
    console.log('📁 Tema actualizado:', updatedTheme);
    console.log('📁 Tema seleccionado actual:', selectedTheme);
    
    onUpdateTheme(updatedTheme);
    console.log('✅ onUpdateTheme llamado');
    
    // Cerrar modal temporalmente para forzar refresh
    const wasOpen = selectedTheme !== null;
    if (wasOpen && selectedTheme.number === updatedTheme.number) {
      console.log('🔄 Cerrando y reabriendo modal...');
      setSelectedTheme(null);
      // Reabrir con datos actualizados
      setTimeout(() => {
        console.log('🔄 Reabriendo modal con datos frescos');
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
      // Soporta formatos:
      // "1. Nombre del tema"
      // "Tema 1: Nombre del tema"
      // "1,Nombre del tema"
      // "1|Nombre del tema"
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
    
    // Aplicar todos los cambios
    updates.forEach(theme => onUpdateTheme(theme));
    setShowBulkImport(false);
    setBulkText('');
  };

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="p-2 bg-white/5 rounded-xl">
            <Icons.ChevronLeft />
          </button>
          <h1 className="text-white font-bold text-2xl flex-1">Temas</h1>
          <button 
            onClick={() => setShowBulkImport(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Icons.Plus />
            Importar Nombres
          </button>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-white/5 text-white rounded-xl px-4 py-3 pl-12 border border-white/10" 
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons.Search />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          {filteredThemes.map(theme => {
            const questionCount = theme.questions?.length || 0;
            // Progreso basado en hitos: 0-25 (naranja), 25-50 (amarillo), 50+ (verde)
            const progressPercent = Math.min((questionCount / 50) * 100, 100);
            const hasDocuments = theme.documents?.length > 0;
            
            return (
              <div 
                key={theme.number} 
                onClick={() => setSelectedTheme(theme)} 
                className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Tema {theme.number}</h3>
                    <p className="text-gray-300 text-xs sm:text-sm mt-1 line-clamp-1">{theme.name}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                      questionCount >= 50 ? 'bg-green-500/20 text-green-400' :
                      questionCount >= 25 ? 'bg-yellow-500/20 text-yellow-400' :
                      questionCount > 0 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {questionCount} pregunta{questionCount !== 1 ? 's' : ''}
                    </span>
                    {hasDocuments && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs">
                        {theme.documents.length} doc{theme.documents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent >= 50 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                      progressPercent >= 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                      progressPercent > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                      'bg-gray-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                
                {questionCount === 0 && !hasDocuments && (
                  <p className="text-gray-500 text-xs mt-2">Sin contenido añadido</p>
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

        {/* Modal de importación masiva */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-slate-800 p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-xl">Importar Nombres de Temas</h2>
                  <p className="text-gray-400 text-sm mt-1">Pega la lista completa de tus temas</p>
                </div>
                <button onClick={() => setShowBulkImport(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                  <Icons.X />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <h3 className="text-blue-400 font-semibold text-sm mb-2">📝 Formatos aceptados:</h3>
                  <div className="text-gray-300 text-xs space-y-1 font-mono">
                    <div>1. Constitución Española</div>
                    <div>Tema 2: Derechos Fundamentales</div>
                    <div>3, Organización Territorial</div>
                    <div>4 | Estatuto de Autonomía</div>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 text-sm mb-2 block font-semibold">
                    Pega aquí tu lista (un tema por línea):
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="1. Constitución Española&#10;2. Derechos Fundamentales&#10;3. Organización Territorial&#10;..."
                    className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10 font-mono text-sm min-h-[300px] resize-vertical"
                  />
                  <p className="text-gray-500 text-xs mt-2">
                    {bulkText.split('\n').filter(l => l.trim()).length} líneas detectadas
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowBulkImport(false);
                      setBulkText('');
                    }}
                    className="flex-1 bg-white/5 text-white font-semibold py-3 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={!bulkText.trim()}
                    className="flex-1 bg-blue-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
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
