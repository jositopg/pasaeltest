import React from 'react';
import Icons from '../common/Icons';

function BottomNav({ current, onNavigate, darkMode }) {
  const items = [
    { id: 'home', icon: Icons.Home, label: 'Inicio' },
    { id: 'themes', icon: Icons.Book, label: 'Temas' },
    { id: 'heatmap', icon: Icons.Fire, label: 'Mapa' },
    { id: 'stats', icon: Icons.Stats, label: 'Stats' }
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[9999] h-[72px]
      ${darkMode
        ? 'bg-[#0F172A]/95 border-t border-[#1E293B]'
        : 'bg-white/95 border-t border-slate-200/80'
      } backdrop-blur-xl`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around items-center h-full max-w-lg mx-auto px-2">
        {items.map(item => {
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl min-w-[64px] transition-all duration-200 active:scale-90
                ${isActive
                  ? 'text-white'
                  : darkMode ? 'text-slate-600' : 'text-slate-400'
                }`}
              style={isActive ? {
                background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
              } : {}}
            >
              <item.icon />
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


export default BottomNav;
