import React from 'react';
import { GRADIENT_BG } from '../../utils/constants';

export const AuthLoadingScreen = ({ darkMode }) => (
  <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
    <div className="text-center">
      <div className="text-4xl font-bold animate-pulse" style={{ 
        fontFamily: 'Sora, system-ui', 
        background: GRADIENT_BG, 
        WebkitBackgroundClip: 'text', 
        WebkitTextFillColor: 'transparent' 
      }}>
        PasaElTest
      </div>
      <p className={`mt-2 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Verificando sesión...</p>
    </div>
  </div>
);

export const DataLoadingScreen = ({ darkMode }) => (
  <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
    <div className="text-center">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: GRADIENT_BG }}>
        <span className="text-white text-xl font-bold" style={{ fontFamily: 'Sora, system-ui' }}>P</span>
      </div>
      <div className="text-2xl font-bold" style={{ 
        fontFamily: 'Sora, system-ui', 
        background: GRADIENT_BG, 
        WebkitBackgroundClip: 'text', 
        WebkitTextFillColor: 'transparent' 
      }}>
        PasaElTest
      </div>
      <div className="mt-4 flex gap-1 justify-center">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: '#2563EB', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  </div>
);
