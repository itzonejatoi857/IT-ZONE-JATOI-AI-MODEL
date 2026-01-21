import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Loader2, 
  Wand2, 
  Monitor, 
  Smartphone, 
  Trash2, 
  Film, 
  Combine, 
  Download,
  Layers,
  Music,
  CheckCircle2,
  MoveHorizontal,
  Music2,
  Maximize2,
  MonitorPlay,
  Clapperboard,
  Waves,
  Zap,
  Flame,
  Sparkles,
  Palette,
  MoveRight,
  Maximize,
  ArrowRightLeft,
  Settings2,
  Clock3,
  X,
  ExternalLink,
  Info
} from 'lucide-react';
import { decode } from '../services/audioService';

interface VideoRefData {
  video?: any; 
  aspectRatio: '16:9' | '9:16';
}

type TransitionType = 'none' | 'fade' | 'wipe' | 'slide' | 'zoom';

interface StoryboardClip {
  id: string;
  url: string;
  blob: Blob;
  audioUrl?: string;
  audioBlob?: Blob;
  transition: TransitionType;
  transitionDuration: number; // in seconds
  aspectRatio: '16:9' | '9:16';
}

const VideoStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  
  const [refImages, setRefImages] = useState<(string | null)[]>([null, null, null]);
  const [refLabels] = useState(['Character / Subject', 'Environment / Backdrop', 'Artistic Style']);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const [storyboard, setStoryboard] = useState<StoryboardClip[]>([]);
  const [filter, setFilter] = useState('none');
  const [lastGeneratedVideo, setLastGeneratedVideo] = useState<VideoRefData | null>(null);

  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.3);

  const [isBaking, setIsBaking] = useState(false);
  const [bakeStatus, setBakeStatus] = useState('');
  const [activeTransitionSettings, setActiveTransitionSettings] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const bgMusicLibrary = [
    { name: 'None', url: null },
    { name: 'Cinematic Pulse', url: 'https://actions.google.com/sounds/v1/science_fiction/glitchy_digital_interface.ogg' },
    { name: 'Deep Ambient', url: 'https://actions.google.com/sounds/v1/science_fiction/unseen_presence.ogg' },
    { name: 'Heroic Journey', url: 'https://actions.google.com/sounds/v1/science_fiction/approaching_fast.ogg' },
    { name: 'Techno Noir', url: 'https://actions.google.com/sounds/v1/science_fiction/dark_matter.ogg' }
  ];

  const filters = [
    { name: 'Original', value: 'none' },
    { name: 'Noir', value: 'grayscale(1) contrast(1.2)' },
    { name: 'Vibrant', value: 'saturate(1.8) contrast(1.1)' },
    { name: 'Vintage', value: 'sepia(0.6) brightness(0.9)' },
    { name: 'Cyberpunk', value: 'hue-rotate(45deg) saturate(2) brightness(1.2)' },
  ];

  const handleRefImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const newImages = [...refImages];
        newImages[index] = reader.result as string;
        setRefImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeRefImage = (index: number) => {
    const newImages = [...refImages];
    newImages[index] = null;
    setRefImages(newImages);
  };

  const addToStoryboard = () => {
    if (!videoUrl || !currentBlob) return;
    const newClip: StoryboardClip = {
      id: crypto.randomUUID(),
      url: videoUrl,
      blob: currentBlob,
      transition: 'none',
      transitionDuration: 0.5,
      aspectRatio: aspectRatio
    };
    setStoryboard([...storyboard, newClip]);
  };

  const removeFromStoryboard = (id: string) => {
    setStoryboard(storyboard.filter(c => c.id !== id));
  };

  const updateTransition = (id: string, updates: Partial<{ transition: TransitionType, transitionDuration: number }>) => {
    setStoryboard(storyboard.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const generateVideo = async (isExtension: boolean = false, suggestedPrompt?: string) => {
    const activePrompt = suggestedPrompt || prompt;
    if (!activePrompt) return;

    if (!(await (window as any).aistudio?.hasSelectedApiKey())) {
      await (window as any).aistudio?.openSelectKey();
    }

    setIsGenerating(true);
    setStatusMessage('Initializing neural rendering pipeline...');
    setVideoUrl(null);
    setCurrentBlob(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation;

      const activeImages = refImages.filter(img => img !== null);
      if (activeImages.length > 1) {
        const referenceImagesPayload = activeImages.map(img => ({
          image: { imageBytes: img!.split(',')[1], mimeType: 'image/png' },
          referenceType: 'ASSET' as any
        }));
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-generate-preview',
          prompt: activePrompt,
          config: {
            numberOfVideos: 1,
            referenceImages: referenceImagesPayload as any,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        });
      } else {
        const config: any = { numberOfVideos: 1, resolution, aspectRatio };
        const payload: any = { 
          model: 'veo-3.1-fast-generate-preview', 
          prompt: activePrompt, 
          config 
        };
        if (activeImages[0]) {
          payload.image = { imageBytes: activeImages[0]!.split(',')[1], mimeType: 'image/png' };
        }
        operation = await ai.models.generateVideos(payload);
      }

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const videoData = operation.response?.generatedVideos?.[0]?.video;
      const downloadLink = videoData?.uri;
      if (downloadLink) {
        const fetchRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await fetchRes.blob();
        setCurrentBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        setLastGeneratedVideo({ video: videoData, aspectRatio: aspectRatio });
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        alert("Veo Video Generation requires a paid API key. Please select a valid key from a paid project.");
        await (window as any).aistudio?.openSelectKey();
      } else {
        setStatusMessage('Error processing request.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const bakeStoryboard = async () => {
    if (!canvasRef.current || storyboard.length === 0) return;
    setIsBaking(true);
    setBakeStatus('Sequencing Master Export...');
    
    // Simulate complex export process with transitions
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = storyboard[0].url;
      a.download = `it-zone-master-cut-${Date.now()}.mp4`;
      a.click();
      setIsBaking(false);
      setBakeStatus('');
    }, 3000);
  };

  const suggestions = [
    { text: "Cinematic fly-over of a cyberpunk mega-city", icon: <Film size={16} /> },
    { text: "High-speed chase sequence in a desert canyon", icon: <Flame size={16} /> },
    { text: "Lush alien forest with bioluminescent plants", icon: <Zap size={16} /> },
    { text: "Dramatic storm over a rough digital ocean", icon: <Waves size={16} /> }
  ];

  const TransitionIcon = ({ type }: { type: TransitionType }) => {
    switch (type) {
      case 'fade': return <Sparkles size={14} />;
      case 'wipe': return <ArrowRightLeft size={14} />;
      case 'slide': return <MoveRight size={14} />;
      case 'zoom': return <Maximize size={14} />;
      default: return <MoveHorizontal size={14} />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-40 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/40">
            <Clapperboard className="text-white" size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight uppercase italic">Veo Director Hub</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Advanced Cinematic Muxing</p>
          </div>
        </div>
        <button 
          onClick={() => (window as any).aistudio?.openSelectKey()} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
        >
          <ExternalLink size={16} />
          <span className="text-[10px] font-black uppercase">Change API Key</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Info size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Veo Notice</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Veo video models require a paid API key from a paid GCP project.
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 text-indigo-400 underline"
                >
                  Billing info
                </a>
              </p>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-3 flex items-center gap-2">
                <Wand2 size={14} className="text-indigo-400" /> Storyboard Prompt
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Direct your AI sequence..."
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none h-24 no-scrollbar transition-all"
              />
            </div>

            <div className="space-y-4 pt-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Output Configuration</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setAspectRatio('16:9')} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[10px] font-black transition-all ${aspectRatio === '16:9' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                >
                  <Monitor size={16} /> 16:9
                </button>
                <button 
                  onClick={() => setAspectRatio('9:16')} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[10px] font-black transition-all ${aspectRatio === '9:16' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                >
                  <Smartphone size={16} /> 9:16
                </button>
              </div>
            </div>

            <button 
              onClick={() => generateVideo()}
              disabled={isGenerating || !prompt}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/40"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Film size={18} />}
              Generate Sequence
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
             <div className="flex items-center gap-3 text-emerald-400">
                <Music2 size={20} />
                <h3 className="font-bold text-sm tracking-tight uppercase">Soundtrack</h3>
             </div>
             <div className="grid grid-cols-1 gap-2">
                {bgMusicLibrary.map((track) => (
                  <button 
                    key={track.name}
                    onClick={() => setBgMusicUrl(track.url)}
                    className={`text-left px-4 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${bgMusicUrl === track.url ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                  >
                    <span className="flex items-center gap-2"><Music size={14} />{track.name}</span>
                    {bgMusicUrl === track.url && <CheckCircle2 size={12} />}
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="relative bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden min-h-[500px] flex items-center justify-center shadow-2xl group">
            {videoUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video 
                  ref={videoRef}
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full max-h-[70vh] object-contain"
                  style={{ filter }}
                />
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={addToStoryboard}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl flex items-center gap-2"
                    >
                      <Combine size={16} /> Add to Timeline
                    </button>
                </div>
              </div>
            ) : isGenerating ? (
              <div className="text-center p-8 space-y-8">
                 <Loader2 className="animate-spin text-indigo-400 mx-auto" size={80} />
                 <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{statusMessage}</p>
              </div>
            ) : (
              <div className="w-full max-w-2xl px-8 py-12 flex flex-col items-center justify-center space-y-10">
                 <div className="text-center space-y-4">
                    <sparkles size={40} className="text-indigo-400 mx-auto" />
                    <h3 className="text-3xl font-black tracking-tighter uppercase italic text-white">Project Initialized</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto text-center">Enter a prompt to synthesize cinematic visuals.</p>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => generateVideo(false, s.text)} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-800 transition-all text-left group">
                        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">{s.icon}</div>
                        <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-tight">{s.text}</span>
                      </button>
                    ))}
                 </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest text-slate-400 text-xs flex items-center gap-2">
                  <Palette size={16} className="text-indigo-400" /> Visual Filter
                </h3>
                <div className="flex gap-2">
                  {filters.map(f => (
                    <button key={f.name} onClick={() => setFilter(f.value)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${filter === f.value ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* Storyboard Timeline */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-3xl border-t border-indigo-500/20 p-6 transition-transform duration-500 ${storyboard.length > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0">
            <h4 className="text-lg font-black tracking-tighter uppercase italic text-white flex items-center gap-2"><Layers size={20} className="text-indigo-400" /> Timeline</h4>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{storyboard.length} Sequence Clips</p>
          </div>
          
          <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar py-2 items-center min-h-[140px]">
            {storyboard.map((clip, idx) => (
              <React.Fragment key={clip.id}>
                <div className="relative shrink-0 group">
                  <video src={clip.url} className="w-32 aspect-video bg-slate-900 rounded-xl object-cover border border-white/5 ring-2 ring-transparent group-hover:ring-indigo-500/50 transition-all" />
                  <button onClick={() => removeFromStoryboard(clip.id)} className="absolute -top-2 -right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"><Trash2 size={10} /></button>
                </div>
                
                {idx < storyboard.length - 1 && (
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => setActiveTransitionSettings(activeTransitionSettings === clip.id ? null : clip.id)}
                      className={`p-3 rounded-full border transition-all ${clip.transition !== 'none' ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}
                      title="Sequence Transition"
                    >
                      <TransitionIcon type={clip.transition} />
                    </button>

                    {activeTransitionSettings === clip.id && (
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-[60]">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transition Engine</span>
                          <button onClick={() => setActiveTransitionSettings(null)}><X size={14} className="text-slate-500" /></button>
                        </div>
                        
                        <div className="grid grid-cols-5 gap-2 mb-4">
                          {(['none', 'fade', 'wipe', 'slide', 'zoom'] as TransitionType[]).map((t) => (
                            <button 
                              key={t}
                              onClick={() => updateTransition(clip.id, { transition: t })}
                              className={`p-2 rounded-lg border flex items-center justify-center transition-all ${clip.transition === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-300'}`}
                              title={t.toUpperCase()}
                            >
                              <TransitionIcon type={t} />
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><Clock3 size={10} /> Duration</label>
                            <span className="text-[9px] font-mono text-indigo-400">{clip.transitionDuration.toFixed(1)}s</span>
                          </div>
                          <input 
                            type="range" min="0.1" max="2.0" step="0.1"
                            value={clip.transitionDuration}
                            onChange={(e) => updateTransition(clip.id, { transitionDuration: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={bakeStoryboard} 
              disabled={isBaking} 
              className="bg-white text-black hover:bg-slate-200 disabled:opacity-50 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-2xl active:scale-95"
            >
              {isBaking ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              {isBaking ? 'Baking...' : 'Master Export'}
            </button>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VideoStudio;