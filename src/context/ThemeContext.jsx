import React, { createContext, useContext } from 'react';

const ThemeContext = createContext({ darkMode: false });

/**
 * Construye el objeto de clases de dark mode.
 * Centraliza todos los patrones de estilo repetidos en los componentes.
 */
function buildCx(dm) {
  return {
    // Fondos de pantalla completa
    screen: dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]',
    // Cards estándar (borde ligero + sombra)
    card: dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm',
    // Cards variante oscura (dark bg más pronunciado)
    cardAlt: dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm',
    // Secciones internas dentro de cards (inputs, rows)
    inner: dm ? 'bg-[#1E293B]' : 'bg-slate-50',
    // Texto
    heading: dm ? 'text-white' : 'text-slate-800',
    body: dm ? 'text-gray-300' : 'text-slate-600',
    muted: dm ? 'text-gray-400' : 'text-slate-500',
    faint: dm ? 'text-gray-500' : 'text-slate-400',
    // Separadores
    divider: dm ? 'border-white/10' : 'border-slate-200',
    // Inputs y textareas
    input: dm
      ? 'bg-[#1E293B] border border-[#334155] text-slate-100 focus:border-blue-500'
      : 'bg-[#F8FAFF] border border-slate-200 text-slate-800 focus:border-blue-500',
    // Botón fantasma (secundario)
    btnGhost: dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200',
    // Botón fantasma blanco (el tipo que aparece en navs)
    btnNav: dm ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50',
  };
}

export const useTheme = () => {
  const { darkMode } = useContext(ThemeContext);
  return { darkMode, dm: darkMode, cx: buildCx(darkMode) };
};

export const ThemeProvider = ({ darkMode, children }) => (
  <ThemeContext.Provider value={{ darkMode }}>{children}</ThemeContext.Provider>
);
