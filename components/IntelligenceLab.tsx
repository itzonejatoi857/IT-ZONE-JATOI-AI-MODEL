import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { 
  Send, 
  Search, 
  BrainCircuit, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Loader2, 
  Link as LinkIcon, 
  Download, 
  Sparkles, 
  X, 
  Cpu, 
  RefreshCw, 
  FileCheck,
  Code,
  LineChart,
  FileText,
  Terminal,
  Calculator,
  Globe,
  Zap,
  Wind,
  Info,
  ChevronDown,
  Activity,
  Volume2,
  ExternalLink,
  FileUp,
  FileVideo
} from 'lucide-react';
import { ChatMessage, AspectRatio, ImageSize } from '../types';
import { decode, decodeAudioData } from '../services/audioService';

type IntelligenceModel = 'gemini-3-pro-preview' | 'gemini-3-flash-preview' | 'gemini-flash-lite-latest';

interface AttachedMedia {
  type: 'image' | 'video';
  data: string; // Base64
  name: string;
  previewUrl?: string; // Blob URL for preview
}

const IntelligenceLab: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<IntelligenceModel>('gemini-3-pro-preview');
  const [isThinkingMode, setIsThinkingMode] = useState(true);
  const [isImageMode, setIsImageMode] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState<number | null>(null);
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQR);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleReadAloud = async (text: string, id: number) => {
    if (isSpeakingId !== null) return;
    setIsSpeakingId(id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Remove markdown for better speech synthesis
      const cleanText = text.replace(/[#*`_~]/g, '').substring(0, 1500);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const buffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeakingId(null);
        source.start();
      } else {
        setIsSpeakingId(null);
      }
    } catch (err) {
      console.error(err);
      setIsSpeakingId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a preview URL immediately for the UI
    const previewUrl = URL.createObjectURL(file);
    
    setUploadProgress(0);
    const reader = new FileReader();
    
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    reader.onload = () => {
      setAttachedMedia({ 
        type, 
        name: file.name, 
        data: (reader.result as string).split(',')[1],
        previewUrl
      });
      setUploadProgress(null);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const checkApiKey = async () => {
    if (!(await (window as any).aistudio?.hasSelectedApiKey())) {
      await (window as any).aistudio?.openSelectKey();
    }
  };

  const handleSend = async (suggestedInput?: string) => {
    const currentInput = suggestedInput || input;
    if (!currentInput.trim() && !attachedMedia) return;

    if (isImageMode) {
      await checkApiKey();
    }

    // Capture references to attached media before clearing state
    const mediaToUpload = attachedMedia;
    
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: currentInput || (isImageMode ? `Generating Visual...` : `Analyzing Media...`),
      imageUrl: mediaToUpload?.type === 'image' ? mediaToUpload.previewUrl : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedMedia(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let response: GenerateContentResponse;
      
      if (isImageMode) {
        response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: currentInput || "A stunning cinematic visual" }] },
          config: {
            imageConfig: { aspectRatio, imageSize },
            tools: useSearch ? [{ googleSearch: {} }] : []
          }
        });
        let generatedUrl = '';
        let textResult = '';
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) generatedUrl = `data:image/png;base64,${part.inlineData.data}`;
          else if (part.text) textResult += part.text;
        }
        const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.filter(c => c.web).map(c => ({ title: c.web!.title, url: c.web!.uri })) || [];

        setMessages(prev => [...prev, {
          role: 'model',
          content: textResult || `Generated visual.`,
          imageUrl: generatedUrl,
          groundingLinks
        }]);
      } else {
        const parts: any[] = [{ text: currentInput || 'Analyze this media.' }];
        if (mediaToUpload) {
          parts.push({ 
            inlineData: { 
              mimeType: mediaToUpload.type === 'image' ? 'image/png' : 'video/mp4', 
              data: mediaToUpload.data 
            } 
          });
        }
        
        const contents: any[] = [{ parts }];
        const config: any = {};
        if (useSearch) config.tools = [{ googleSearch: {} }];
        
        if (isThinkingMode) {
          const budget = selectedModel === 'gemini-3-pro-preview' ? 32768 : 24576;
          config.thinkingConfig = { thinkingBudget: budget };
        }
        
        response = await ai.models.generateContent({ model: selectedModel, contents, config });
        const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.filter(c => c.web).map(c => ({ title: c.web!.title, url: c.web!.uri })) || [];
        
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: response.text || 'Synthesis complete.', 
          isThinking: isThinkingMode, 
          groundingLinks 
        }]);
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found")) {
        alert("Advanced reasoning/generation requires a paid API key. Please select a key from a paid GCP project.");
        await (window as any).aistudio?.openSelectKey();
      } else {
        setMessages(prev => [...prev, { role: 'model', content: "Error in Intelligence Engine. Verify project status or API key permissions." }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const modelConfigs = [
    { id: 'gemini-3-pro-preview', name: 'Gemini Pro', icon: Cpu, color: 'text-indigo-400', desc: 'Maximum Reasoning & Logic' },
    { id: 'gemini-3-flash-preview', name: 'Gemini Flash', icon: Zap, color: 'text-emerald-400', desc: 'High Performance & Speed' },
    { id: 'gemini-flash-lite-latest', name: 'Flash Lite', icon: Wind, color: 'text-sky-400', desc: 'Efficiency & Low Latency' }
  ];

  return (
    <div className="flex flex-col h-[85vh] bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-500">
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><BrainCircuit size={20} /></div>
          <div><h3 className="font-bold">Intelligence Lab</h3><p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Multimodal Reasoning</p></div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Info size={12} className="text-indigo-400" />
            <span className="text-[9px] font-black uppercase tracking-tighter text-indigo-300">Key Sync Required for Pro/Creative</span>
          </div>
          {!isImageMode && (
            <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shadow-inner">
              {modelConfigs.map((cfg) => {
                const Icon = cfg.icon;
                const isActive = selectedModel === cfg.id;
                return (
                  <button 
                    key={cfg.id}
                    onClick={() => setSelectedModel(cfg.id as IntelligenceModel)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${isActive ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}
                    `}
                    title={cfg.desc}
                  >
                    <Icon size={12} />
                    <span className="hidden sm:inline">{cfg.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setIsImageMode(!isImageMode); if (!isImageMode) setIsThinkingMode(false); }} 
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-black uppercase transition-all ${isImageMode ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Sparkles size={14} /> Creative
            </button>
            {!isImageMode && (
              <button 
                onClick={() => setIsThinkingMode(!isThinkingMode)} 
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-black uppercase transition-all ${isThinkingMode ? 'bg-amber-500 text-black shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                <BrainCircuit size={14} /> {isThinkingMode ? 'Thinking On' : 'Reasoning'}
              </button>
            )}
            <button 
              onClick={() => setUseSearch(!useSearch)} 
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-black uppercase transition-all ${useSearch ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Search size={14} /> Search
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-slate-950/30">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60 p-12">
            <div className="relative">
               <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
               <div className="relative p-8 bg-slate-900 rounded-full border border-slate-800 shadow-2xl">
                 <BrainCircuit size={64} className="text-indigo-400 animate-pulse" />
               </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter mb-2">Neural Nexus Connection</h2>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Model Online: {selectedModel === 'gemini-3-pro-preview' ? 'Pro Reasoning' : selectedModel === 'gemini-3-flash-preview' ? 'Flash Velocity' : 'Lite Efficiency'}</p>
              </div>
              <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                Choose <span className="text-indigo-400 font-bold">Pro</span> for complex reasoning & code, 
                <span className="text-emerald-400 font-bold"> Flash</span> for high-speed analysis, 
                or <span className="text-sky-400 font-bold">Lite</span> for efficient, low-latency tasks.
              </p>
              <p className="mt-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">
                Pro & Creative models require a paid API key.
              </p>
            </div>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start animate-in fade-in slide-in-from-bottom-2'}`}>
            <div className={`max-w-[85%] rounded-[2rem] p-6 relative group ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-xl rounded-tr-none' : 'bg-slate-900 text-slate-200 border border-white/5 shadow-2xl rounded-tl-none'}`}>
              <div className="flex justify-between items-start mb-4">
                {m.role === 'model' && (
                  <button 
                    onClick={() => handleReadAloud(m.content, i)}
                    disabled={isSpeakingId !== null}
                    className={`p-2 rounded-xl transition-all ${isSpeakingId === i ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Read Aloud"
                  >
                    {isSpeakingId === i ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                  </button>
                )}
                {m.isThinking && (
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl w-fit">
                    <Cpu size={14} className="text-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Deep Reasoning Chain</span>
                  </div>
                )}
              </div>
              {m.imageUrl && (
                <div className="mb-4 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group relative cursor-pointer">
                  <img src={m.imageUrl} alt="Message Attachment" className="w-full max-h-[500px] object-contain bg-black/40" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <a href={m.imageUrl} download="it-zone-analysis.png" onClick={(e) => e.stopPropagation()} className="p-3 bg-white text-black rounded-full shadow-2xl scale-0 group-hover:scale-100 transition-transform"><Download size={20} /></a>
                  </div>
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed font-medium text-slate-200">{m.content}</div>
              {m.groundingLinks && m.groundingLinks.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-700/50 flex flex-wrap gap-2">
                  {m.groundingLinks.map((link, idx) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 transition-all hover:text-white">
                      <LinkIcon size={12} className="text-indigo-400" /> {link.title.substring(0, 35)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 rounded-3xl px-6 py-4 border border-white/5 flex items-center gap-4 shadow-xl animate-pulse">
              <Loader2 className="animate-spin text-indigo-400" size={20} />
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Neural Sync</span>
                <span className="text-xs text-slate-500 font-bold">{selectedModel.includes('pro') ? 'Reasoning...' : 'Synthesizing...'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 relative z-20">
        {uploadProgress !== null && (
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
             <div 
              className="h-full bg-indigo-500 transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
             />
          </div>
        )}

        {attachedMedia && (
          <div className="mb-4 flex items-center gap-4 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-indigo-500/30 group animate-in slide-in-from-bottom-2 shadow-2xl max-w-sm">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-slate-900">
               {attachedMedia.type === 'image' && attachedMedia.previewUrl ? (
                 <img src={attachedMedia.previewUrl} className="w-full h-full object-cover" alt="Preview" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-indigo-400">
                   <FileVideo size={24} />
                 </div>
               )}
            </div>
            <div className="flex-1 overflow-hidden">
               <span className="text-xs font-bold text-slate-200 block truncate">{attachedMedia.name}</span>
               <div className="flex items-center gap-2 mt-1">
                 <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Media Buffer Ready</span>
               </div>
            </div>
            <button 
              onClick={() => {
                if (attachedMedia.previewUrl) URL.revokeObjectURL(attachedMedia.previewUrl);
                setAttachedMedia(null);
              }} 
              className="p-2.5 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 focus-within:border-indigo-500/50 transition-all rounded-[2.5rem] p-2 shadow-inner ring-1 ring-white/5">
          <div className="flex gap-1 pl-2">
            <label className={`p-3 rounded-2xl cursor-pointer text-slate-500 hover:text-indigo-400 hover:bg-slate-900 transition-all ${uploadProgress !== null ? 'opacity-20 pointer-events-none' : ''}`} title="Attach Image">
              <ImageIcon size={20} />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
            </label>
            <label className={`p-3 rounded-2xl cursor-pointer text-slate-500 hover:text-indigo-400 hover:bg-slate-900 transition-all ${uploadProgress !== null ? 'opacity-20 pointer-events-none' : ''}`} title="Attach Video">
              <FileVideo size={20} />
              <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} />
            </label>
          </div>
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            placeholder={attachedMedia ? "Explain what to analyze in this media..." : `Instruct ${selectedModel === 'gemini-3-pro-preview' ? 'Pro reasoning engine' : selectedModel === 'gemini-3-flash-preview' ? 'Flash velocity engine' : 'Lite efficient engine'}...`} 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-4 px-3 outline-none text-slate-200 placeholder:text-slate-700 font-bold" 
          />
          <button 
            onClick={() => handleSend()} 
            disabled={isLoading || uploadProgress !== null || (!input.trim() && !attachedMedia)} 
            className="p-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full shadow-2xl transition-all active:scale-95 flex items-center justify-center min-w-[56px] h-[56px]"
          >
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
          </button>
        </div>
        
        <div className="flex justify-center gap-6 mt-3 opacity-30 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
           <div className="flex items-center gap-2"><Activity size={12} /> Search Grounding</div>
           <div className="flex items-center gap-2"><Globe size={12} /> Multimodal Ingest</div>
           <div className="flex items-center gap-2"><Sparkles size={12} /> Pro Tier</div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceLab;