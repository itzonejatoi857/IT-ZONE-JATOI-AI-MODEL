
import React from 'react';
import { ToolTab } from '../types';
import { 
  Sparkles, 
  Mic2, 
  Image as ImageIcon, 
  Video, 
  MessageSquare, 
  Search,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  Code2,
  Stethoscope
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: ToolTab) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const features = [
    { 
      title: 'Multimodal Hub', 
      desc: 'Analyze images, videos, and complex code using Gemini 3 Pro.', 
      icon: MessageSquare,
      tab: ToolTab.INTELLIGENCE,
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      title: 'Live Conversational Voice', 
      desc: 'Low-latency natural speech interaction powered by Native Audio.', 
      icon: Mic2,
      tab: ToolTab.LIVE_VOICE,
      color: 'from-purple-500 to-pink-500'
    },
    { 
      title: 'Creative Studio', 
      desc: 'Generate 4K images and cinematic videos with Veo 3.1 & Imagen.', 
      icon: ImageIcon,
      tab: ToolTab.IMAGE_STUDIO,
      color: 'from-indigo-500 to-purple-500'
    },
    { 
      title: 'Deep Reasoning', 
      desc: 'Switch to Thinking Mode for your most complex logic tasks.', 
      icon: Zap,
      tab: ToolTab.INTELLIGENCE,
      color: 'from-amber-500 to-orange-500'
    }
  ];

  const quickPrompts = [
    { text: "Debug React Performance Issues", icon: <Code2 size={14} />, tab: ToolTab.INTELLIGENCE },
    { text: "Analyze Financial Market Trends", icon: <TrendingUp size={14} />, tab: ToolTab.INTELLIGENCE },
    { text: "Diagnose Skin Irritation Visuals", icon: <Stethoscope size={14} />, tab: ToolTab.HEALTH },
    { text: "Gen 4K Futuristic Cityscape", icon: <Sparkles size={14} />, tab: ToolTab.IMAGE_STUDIO },
  ];

  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h2 className="text-4xl lg:text-6xl font-bold tracking-tight">
          Accelerate your <span className="text-indigo-400 underline decoration-indigo-600/30 decoration-8">Intelligence.</span>
        </h2>
        <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
          Welcome to <span className="text-slate-100 font-semibold">IT ZONE JATOI</span>. 
          A bleeding-edge workspace integrating Gemini 3's reasoning, 
          Veo's cinematic video generation, and real-time audio interaction.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f, i) => (
          <button
            key={i}
            onClick={() => onNavigate(f.tab)}
            className="group relative flex flex-col items-start p-8 bg-slate-900 border border-slate-800 rounded-3xl transition-all duration-300 hover:scale-[1.02] hover:bg-slate-800/80 hover:border-indigo-500/50 shadow-2xl"
          >
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${f.color} mb-6 group-hover:rotate-6 transition-transform shadow-lg`}>
              <f.icon className="text-white" size={28} />
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-300 transition-colors">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed text-left">{f.desc}</p>
            <div className="mt-8 flex items-center gap-2 text-indigo-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Launch Module <Sparkles size={14} />
            </div>
          </button>
        ))}
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
           <Zap className="text-amber-400" size={20} />
           <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Featured Scenarios</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickPrompts.map((p, i) => (
            <button 
              key={i} 
              onClick={() => onNavigate(p.tab)}
              className="group flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:bg-slate-800 hover:border-indigo-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  {p.icon}
                </div>
                <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{p.text}</span>
              </div>
              <ArrowUpRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-16 bg-gradient-to-br from-indigo-900/20 to-slate-900 rounded-[3rem] p-12 border border-indigo-500/10 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
              <ShieldCheck size={14} /> Enterprise AI
            </div>
            <h3 className="text-3xl font-bold mb-6">Powered by the Latest Gemini Stack</h3>
            <ul className="space-y-4">
              {[
                'Search Grounding for factual correctness',
                'Veo 3.1 Fast Video Generation',
                'High-Fidelity 4K Imagen Generations',
                'Advanced 32K Thinking Budget reasoning'
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-800/40 p-6 rounded-2xl border border-white/5 shadow-xl">
                <span className="block text-3xl font-bold text-white mb-1">99%</span>
                <span className="text-slate-500 text-xs font-semibold uppercase">Uptime</span>
             </div>
             <div className="bg-slate-800/40 p-6 rounded-2xl border border-white/5 shadow-xl">
                <span className="block text-3xl font-bold text-white mb-1">&lt;2s</span>
                <span className="text-slate-500 text-xs font-semibold uppercase">Latency</span>
             </div>
             <div className="bg-slate-800/40 p-6 rounded-2xl border border-white/5 col-span-2 shadow-xl">
                <span className="block text-xl font-bold text-white mb-1">Gemini 3 Pro</span>
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Active reasoning model</span>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
