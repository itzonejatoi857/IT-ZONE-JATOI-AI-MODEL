import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Mic2, 
  ImageIcon, 
  Video, 
  BrainCircuit, 
  Wrench,
  Menu,
  X,
  ChevronRight,
  HeartPulse,
  Sun,
  Moon
} from 'lucide-react';
import { ToolTab } from './types';
import Dashboard from './components/Dashboard';
import VoiceHub from './components/VoiceHub';
import ImageStudio from './components/ImageStudio';
import VideoStudio from './components/VideoStudio';
import IntelligenceLab from './components/IntelligenceLab';
import Utilities from './components/Utilities';
import Health from './components/Health';

const LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234f46e5'/%3E%3Cstop offset='100%25' style='stop-color:%237c3aed'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='48' fill='%230f172a' stroke='url(%23g)' stroke-width='4'/%3E%3Cpath d='M35 35 L35 65 M35 65 L65 65 M50 35 L50 65 M65 35 L65 65' fill='none' stroke='white' stroke-width='6' stroke-linecap='round'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%2310b981'/%3E%3C/svg%3E";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ToolTab>(ToolTab.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('it_zone_theme');
    // Default to dark mode for the premium IT ZONE feel
    return saved ? saved === 'dark' : true;
  });

  // Apply dark class to root document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('it_zone_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('it_zone_theme', 'light');
    }
  }, [isDarkMode]);

  const navItems = [
    { id: ToolTab.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: ToolTab.LIVE_VOICE, label: 'Live Voice Assistant', icon: Mic2 },
    { id: ToolTab.IMAGE_STUDIO, label: 'Creative Image Studio', icon: ImageIcon },
    { id: ToolTab.VIDEO_GEN, label: 'Veo Video Lab', icon: Video },
    { id: ToolTab.INTELLIGENCE, label: 'Intelligence Lab', icon: BrainCircuit },
    { id: ToolTab.HEALTH, label: 'Health Advisor', icon: HeartPulse },
    { id: ToolTab.UTILITIES, label: 'Utilities & Tools', icon: Wrench },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case ToolTab.DASHBOARD: return <Dashboard onNavigate={setActiveTab} />;
      case ToolTab.LIVE_VOICE: return <VoiceHub />;
      case ToolTab.IMAGE_STUDIO: return <ImageStudio />;
      case ToolTab.VIDEO_GEN: return <VideoStudio />;
      case ToolTab.INTELLIGENCE: return <IntelligenceLab />;
      case ToolTab.HEALTH: return <Health />;
      case ToolTab.UTILITIES: return <Utilities />;
      default: return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`
          fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300
          ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Mobile Sidebar Toggle Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`
          lg:hidden fixed top-6 left-6 z-50 p-3 rounded-2xl shadow-2xl transition-all duration-300
          ${isSidebarOpen ? 'bg-indigo-600 text-white translate-x-60' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800'}
        `}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-500
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex flex-col items-center relative">
            {/* Theme Toggle Switcher */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="absolute top-4 right-4 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative mb-4 group cursor-pointer" onClick={() => setActiveTab(ToolTab.DASHBOARD)}>
              <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-10 dark:opacity-20 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
              <img 
                src={LOGO_SVG} 
                alt="IT ZONE JATOI Logo" 
                className="relative w-24 h-24 rounded-full shadow-2xl border-2 border-slate-200 dark:border-indigo-500/20 group-hover:border-indigo-500/50 transition-all duration-300"
              />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black bg-gradient-to-br from-indigo-600 dark:from-indigo-400 via-violet-600 dark:via-violet-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent tracking-tighter uppercase italic">
                IT ZONE JATOI
              </h1>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-bold">Neural Engine v3.1</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar py-2">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  style={{ transitionDelay: `${idx * 40}ms` }}
                  className={`
                    w-full flex items-center justify-between group px-4 py-3.5 rounded-2xl transition-all duration-300
                    ${isActive 
                      ? 'bg-indigo-600/10 text-indigo-600 dark:text-white border border-indigo-500/20 shadow-[0_4px_12px_rgba(79,70,229,0.05)]' 
                      : 'hover:bg-gradient-to-r hover:from-indigo-600/5 hover:to-transparent hover:scale-[1.03] hover:shadow-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent hover:border-indigo-500/10'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`
                      p-2 rounded-xl transition-all duration-300
                      ${isActive ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-indigo-400 group-hover:scale-105 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm group-hover:shadow-indigo-500/10'}
                    `}>
                      <Icon size={18} />
                    </div>
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                  </div>
                  {isActive && <ChevronRight size={14} className="text-indigo-400/50 animate-in fade-in slide-in-from-left-2 duration-300" />}
                </button>
              );
            })}
          </nav>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800/50">
            <div className="relative group overflow-hidden bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-all duration-300 hover:border-indigo-500/30">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Core</span>
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Gemini 3 Pro + Veo</p>
                <div className="mt-3 h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-4/5 bg-indigo-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto no-scrollbar bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto p-6 lg:p-12 animate-in fade-in duration-700">
          <div className="mb-10 lg:hidden h-12" /> {/* Spacer for mobile button */}
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;