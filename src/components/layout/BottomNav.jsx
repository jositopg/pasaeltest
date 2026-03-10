import React from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function BottomNav({ current, onNavigate }) {
  const { dm } = useTheme();
  const items = [
    { id: 'home', icon: Icons.Home, label: 'Inicio' },
    { id: 'themes', icon: Icons.Book, label: 'Temas' },
    { id: 'questions', icon: Icons.Questions, label: 'Preguntas' },
    { id: 'stats', icon: Icons.Stats, label: 'Stats' }
  ];

  return (
    // Outer: total height = 72px content + home-bar safe area.
    // paddingBottom pushes the inner row up above the home indicator.
    <div
      className={`fixed bottom-0 left-0 right-0 z-[9999] backdrop-blur-xl
        ${dm
          ? 'bg-[#0F172A]/95 border-t border-[#1E293B]'
          : 'bg-white/95 border-t border-slate-200/80'
        }`}
      style={{
        height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Inner row: always 72px, items fill evenly with flex-1 — no overflow on any screen */}
      <div className="flex items-center max-w-lg mx-auto px-1" style={{ height: '72px' }}>
        {items.map(item => {
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl
                transition-all duration-200 active:scale-90
                ${isActive
                  ? 'text-white'
                  : dm ? 'text-slate-500' : 'text-slate-500'
                }`}
              style={isActive ? {
                background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
              } : {}}
            >
              <item.icon />
              <span className="text-[10px] font-semibold tracking-wide leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


export default BottomNav;
