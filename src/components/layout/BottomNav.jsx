import React from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function BottomNav({ current, onNavigate, isAcademy }) {
  const { dm } = useTheme();

  const academyItems = [
    { id: 'home', icon: Icons.Home, label: 'Inicio' },
    { id: 'exams', icon: Icons.Book, label: 'Planes' },
    { id: 'alumnos', icon: Icons.Users, label: 'Alumnos' },
    { id: 'settings', icon: Icons.Settings, label: 'Ajustes' },
  ];

  // sub-screens that map to a parent tab
  const activeId = current === 'themes' ? 'exams'
                 : current === 'exam-active' ? 'exam'
                 : current;

  const navBase = `fixed bottom-0 left-0 right-0 z-[9999] backdrop-blur-xl ${
    dm ? 'bg-[#0F172A]/95 border-t border-[#1E293B]' : 'bg-white/95 border-t border-slate-200/80'
  }`;
  const navStyle = {
    height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  };

  const TabButton = ({ item }) => {
    const isActive = activeId === item.id;
    return (
      <button
        onClick={() => onNavigate(item.id)}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl
          transition-all duration-200 active:scale-90
          ${isActive ? 'text-white' : dm ? 'text-slate-500' : 'text-slate-400'}`}
        style={isActive ? {
          background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
          boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
        } : {}}
      >
        <item.icon />
        <span className="text-[10px] font-semibold tracking-wide leading-none">{item.label}</span>
      </button>
    );
  };

  // Academy nav — 4 equal tabs
  if (isAcademy) {
    return (
      <div className={navBase} style={navStyle}>
        <div className="flex items-center max-w-lg mx-auto px-1" style={{ height: '72px' }}>
          {academyItems.map(item => <TabButton key={item.id} item={item} />)}
        </div>
      </div>
    );
  }

  // Student nav — 5 tabs, center "Test" button is elevated and always highlighted
  const leftItems = [
    { id: 'home', icon: Icons.Home, label: 'Inicio' },
    { id: 'exams', icon: Icons.Book, label: 'Planes' },
  ];
  const rightItems = [
    { id: 'review', icon: Icons.Refresh, label: 'Repasar' },
    { id: 'stats', icon: Icons.Stats, label: 'Resultados' },
  ];
  const isTestActive = activeId === 'exam';

  return (
    <div className={navBase} style={navStyle}>
      <div className="flex items-center max-w-lg mx-auto px-1" style={{ height: '72px' }}>
        {/* Left tabs */}
        {leftItems.map(item => <TabButton key={item.id} item={item} />)}

        {/* CENTER — prominent Test button, always with gradient, floats above nav */}
        <div className="flex-1 flex items-center justify-center" style={{ paddingBottom: '2px' }}>
          <button
            onClick={() => onNavigate('exam')}
            className="flex flex-col items-center justify-center gap-0.5 rounded-2xl text-white transition-all duration-200 active:scale-90"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              boxShadow: isTestActive
                ? '0 8px 24px rgba(37,99,235,0.65)'
                : '0 4px 18px rgba(37,99,235,0.45)',
              width: '60px',
              height: '54px',
              transform: 'translateY(-10px)',
              border: isTestActive ? '2px solid rgba(255,255,255,0.35)' : '2px solid transparent',
            }}
          >
            {/* Lightning bolt icon */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[10px] font-bold tracking-wide leading-none">Test</span>
          </button>
        </div>

        {/* Right tabs */}
        {rightItems.map(item => <TabButton key={item.id} item={item} />)}
      </div>
    </div>
  );
}

export default BottomNav;
