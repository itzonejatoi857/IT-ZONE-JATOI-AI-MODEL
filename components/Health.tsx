import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  HeartPulse, 
  Search, 
  Send, 
  Loader2, 
  Link as LinkIcon, 
  AlertTriangle, 
  Stethoscope,
  Activity,
  ClipboardList,
  Image as ImageIcon,
  Video as VideoIcon, 
  X,
  FileUp,
  Camera,
  CircleStop,
  Video,
  Scan,
  RefreshCw,
  Sparkles,
  History,
  PlusCircle,
  Trash2,
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
  ShieldAlert,
  Thermometer,
  ShieldCheck,
  AlertCircle,
  Zap,
  Leaf,
  Brain,
  Bone,
  CheckCircle2,
  Info,
  Edit2,
  Archive,
  ArchiveRestore,
  Filter,
  Check,
  MessageSquare,
  Circle,
  Camera as ShutterIcon,
  Video as VideoStreamIcon,
  Volume2,
  Eye,
  Microscope,
  Focus,
  Target
} from 'lucide-react';
import { ChatMessage } from '../types';
import { blobToBase64, decode, decodeAudioData } from '../services/audioService';

interface HealthSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
  isArchived?: boolean;
}

type CaptureMode = 'photo' | 'video';

const Health: React.FC = () => {
  const symptomCheckerUrl = "https://www.mayoclinic.org/symptom-checker/select-symptom/itt-20009075";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState<number | null>(null);
  const [attachedMedia, setAttachedMedia] = useState<{ type: 'image' | 'video', data: string, name: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  // Session History Management
  const [sessions, setSessions] = useState<HealthSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'active' | 'archived'>('active');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Integrated Camera Feed State
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Persistence logic
  useEffect(() => {
    const saved = localStorage.getItem('it_zone_health_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HealthSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          const active = parsed.find(s => !s.isArchived);
          if (active) {
            setCurrentSessionId(active.id);
            setMessages(active.messages);
          }
        }
      } catch (e) {
        console.error("Failed to parse health history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;

    setSessions(prev => {
      let updatedSessions = [...prev];
      const sessionIndex = updatedSessions.findIndex(s => s.id === currentSessionId);

      if (sessionIndex >= 0) {
        updatedSessions[sessionIndex] = {
          ...updatedSessions[sessionIndex],
          messages: messages,
          timestamp: Date.now()
        };
      } else {
        const newId = currentSessionId || crypto.randomUUID();
        if (!currentSessionId) setCurrentSessionId(newId);
        
        updatedSessions.unshift({
          id: newId,
          title: messages[0].content.substring(0, 40) || "New Analysis",
          timestamp: Date.now(),
          messages: messages,
          isArchived: false
        });
      }

      updatedSessions.sort((a, b) => b.timestamp - a.timestamp);
      const limited = updatedSessions.slice(0, 50);
      localStorage.setItem('it_zone_health_history', JSON.stringify(limited));
      return limited;
    });
  }, [messages, currentSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, isCapturing]);

  useEffect(() => {
    if (recordingStatus === 'recording') {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recordingStatus]);

  const handleReadAloud = async (text: string, id: number) => {
    if (isSpeakingId !== null) return;
    setIsSpeakingId(id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const cleanText = text.replace(/[#*`_~]/g, '').substring(0, 1500);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Clinical Report Summary: ${cleanText}` }] }],
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

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(crypto.randomUUID());
    setShowHistory(false);
  };

  const loadSession = (session: HealthSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this health record?")) return;
    
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem('it_zone_health_history', JSON.stringify(updated));
    if (currentSessionId === id) {
      setMessages([]);
      setCurrentSessionId(null);
    }
  };

  const toggleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.map(s => s.id === id ? { ...s, isArchived: !s.isArchived } : s);
    setSessions(updated);
    localStorage.setItem('it_zone_health_history', JSON.stringify(updated));
  };

  const startRenaming = (session: HealthSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const saveRename = (e: React.FormEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (!editingSessionId) return;
    const updated = sessions.map(s => s.id === editingSessionId ? { ...s, title: editingTitle } : s);
    setSessions(updated);
    localStorage.setItem('it_zone_health_history', JSON.stringify(updated));
    setEditingSessionId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };
    reader.onload = () => {
      setAttachedMedia({
        type,
        name: file.name,
        data: (reader.result as string).split(',')[1]
      });
      setUploadProgress(null);
    };
    reader.onerror = () => setUploadProgress(null);
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }, 
        audio: true 
      });
      cameraStreamRef.current = stream;
      setIsCapturing(true);
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }, 200);
    } catch (err) {
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const takeSnapshot = () => {
    if (!videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setAttachedMedia({
        type: 'image',
        name: `snapshot_${Date.now()}.png`,
        data: dataUrl.split(',')[1]
      });
      closeCamera();
    }
  };

  const startRecording = () => {
    if (!cameraStreamRef.current) return;
    const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType: 'video/webm;codecs=vp8,opus' });
    cameraRecorderRef.current = recorder;
    cameraChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) cameraChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(cameraChunksRef.current, { type: 'video/mp4' });
      const base64 = await blobToBase64(blob);
      setAttachedMedia({ 
        type: 'video', 
        data: base64, 
        name: `video_capture_${Date.now()}.mp4` 
      });
      closeCamera();
    };
    recorder.start();
    setRecordingStatus('recording');
  };

  const stopRecording = () => {
    cameraRecorderRef.current?.stop();
    setRecordingStatus('idle');
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setIsCapturing(false);
    setRecordingStatus('idle');
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSend = async (suggestedQuery?: string) => {
    const query = suggestedQuery || input;
    if (!query.trim() && !attachedMedia) return;

    if (!currentSessionId) setCurrentSessionId(crypto.randomUUID());

    const userMessage: ChatMessage = { 
      role: 'user', 
      content: query || (attachedMedia ? `Requesting detailed AI analysis for this ${attachedMedia.type} concern.` : ''),
      imageUrl: attachedMedia?.type === 'image' ? `data:image/png;base64,${attachedMedia.data}` : undefined
    };
    
    setMessages(prev => [...prev, userMessage]);
    if (!suggestedQuery) setInput('');
    const mediaToProcess = attachedMedia;
    setAttachedMedia(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contents: any = {
        parts: [{ text: query || "Analyze this visual health asset in detail. Provide structured insights." }]
      };

      if (mediaToProcess) {
        contents.parts.push({
          inlineData: {
            mimeType: mediaToProcess.type === 'image' ? 'image/png' : 'video/mp4',
            data: mediaToProcess.data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: contents,
        config: {
          systemInstruction: `You are the 'IT ZONE JATOI Health & Wellness Core'.
          If an image is provided, your priority is to perform an EXHAUSTIVE MULTIMODAL CLINICAL ANALYSIS.
          
          When providing diagnostic insights, ALWAYS use this exact structure:
          
          ### 1. CLINICAL ANALYSIS
          [A precise description of visual observations or symptom clusters. If an image is provided, describe textures, colors, borders, and anatomical markers in professional detail.]

          ### 2. POTENTIAL CONDITIONS
          - [Condition Name]: [Brief explanation of why it fits]
          - [Condition Name]: [Brief explanation]

          ### 3. RECOMMENDED NEXT STEPS
          - [Immediate Step]: [Why it is necessary]
          - [Follow-up Step]: [What to monitor]

          ### 4. CONFIDENCE SCORE
          [A numerical value 0-100 indicating your certainty based on the input quality]

          ### 5. MEDICAL DISCLAIMER
          [MANDATORY: State clearly that this is an AI screening tool, not a professional medical diagnosis. Instruct users to consult a doctor immediately for clinical validation.]`,
          tools: [{ googleSearch: {} }]
        }
      });

      const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(c => c.web)
        .map(c => ({ title: c.web!.title, url: c.web!.uri })) || [];

      setMessages(prev => [...prev, {
        role: 'model',
        content: response.text || 'Synthesis complete.',
        groundingLinks
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: "### Error\nDiagnostic engine failure. Please retry." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseConfidence = (content: string) => {
    const match = content.match(/### 4\. CONFIDENCE SCORE\s*(\d+)%?/i);
    return match ? parseInt(match[1]) : null;
  };

  const filteredSessions = sessions.filter(s => 
    historyFilter === 'archived' ? s.isArchived : !s.isArchived
  );

  return (
    <div className="flex flex-col h-[85vh] bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
            <HeartPulse size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Health Advisor</h3>
            <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 font-black">Medical Intelligence Core</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <a 
            href={symptomCheckerUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750 rounded-2xl transition-all text-xs font-bold shadow-lg"
          >
            <ExternalLink size={16} className="text-emerald-500" />
            <span className="hidden xs:inline">Mayo Symptom Checker</span>
          </a>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-3 rounded-2xl transition-all border ${showHistory ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-900/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
            title="Recall History"
          >
            <History size={20} />
          </button>
          <button 
            onClick={startNewChat}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-lg shadow-indigo-900/40"
            title="Start New Chat"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Integrated Medical Scanner HUD */}
        {isCapturing && (
          <div className="flex-shrink-0 bg-slate-950 border-b border-slate-800 p-0 animate-in slide-in-from-top duration-500 relative z-30 overflow-hidden">
             <div className="max-w-4xl mx-auto h-[60vh] flex flex-col items-center justify-center relative bg-black">
                {/* Camera Surface */}
                <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-contain" />
                
                {/* Medical Overlay / Crosshair */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className="w-64 h-64 border border-emerald-500/30 rounded-full flex items-center justify-center relative">
                      <div className="absolute w-full h-full border-4 border-emerald-500/50 rounded-full animate-[ping_3s_linear_infinite] opacity-20" />
                      <Target size={32} className="text-emerald-500 opacity-40" />
                      
                      {/* Biometric Corners */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-500" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500" />
                   </div>
                </div>

                {/* HUD Top Controls */}
                <div className="absolute top-6 left-6 flex items-center gap-3">
                  <div className={`px-4 py-2 rounded-full border border-white/10 backdrop-blur-xl flex items-center gap-3 transition-all ${recordingStatus === 'recording' ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-slate-900/80'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${recordingStatus === 'recording' ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      {recordingStatus === 'recording' ? 'Biolink Ingesting' : 'Biometric Ready'}
                    </span>
                  </div>
                  {recordingStatus === 'recording' && (
                    <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 text-white text-[12px] font-mono font-black rounded-full shadow-lg">
                      {formatTime(recordingTime)}
                    </div>
                  )}
                </div>

                <button 
                  onClick={closeCamera} 
                  disabled={recordingStatus === 'recording'}
                  className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/10 transition-all backdrop-blur-md disabled:opacity-20"
                >
                  <X size={20} />
                </button>

                {/* Left Side Status HUD */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-6 opacity-60">
                   {[
                     { label: 'OPTI', val: '88.4' },
                     { label: 'DERM', val: '92.1' },
                     { label: 'BONE', val: '74.2' }
                   ].map(hud => (
                     <div key={hud.label} className="flex flex-col">
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{hud.label}</span>
                        <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                           <div className="h-full bg-emerald-500" style={{ width: `${hud.val}%` }} />
                        </div>
                     </div>
                   ))}
                </div>

                {/* Bottom HUD - Mode Selector & Action Button */}
                <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6">
                  {/* Mode Tabs */}
                  <div className={`flex items-center gap-1 p-1 bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/5 transition-opacity duration-300 ${recordingStatus === 'recording' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button 
                      onClick={() => setCaptureMode('photo')}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${captureMode === 'photo' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      Medical Photo
                    </button>
                    <button 
                      onClick={() => setCaptureMode('video')}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${captureMode === 'video' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      Motion Scan
                    </button>
                  </div>

                  {/* Main Shutter / Action Button */}
                  <div className="relative group">
                    {captureMode === 'photo' ? (
                      <button 
                        onClick={takeSnapshot}
                        className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center p-1 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                      >
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center group-active:scale-90 transition-transform">
                          <Focus size={24} className="text-black" />
                        </div>
                      </button>
                    ) : (
                      <button 
                        onClick={recordingStatus === 'recording' ? stopRecording : startRecording}
                        className={`w-20 h-20 rounded-full border-4 transition-all flex items-center justify-center p-1 active:scale-95 ${recordingStatus === 'recording' ? 'border-red-500 bg-red-500/20' : 'border-white bg-transparent hover:scale-105'}`}
                      >
                        <div className={`transition-all duration-300 ${recordingStatus === 'recording' ? 'w-8 h-8 rounded-lg bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'w-full h-full rounded-full bg-white flex items-center justify-center group-active:scale-90'}`}>
                          {recordingStatus === 'idle' && <VideoStreamIcon size={24} className="text-black" />}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* Messages Feed */}
        <div ref={scrollRef} className={`flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar bg-slate-950/30 transition-opacity duration-300 ${showHistory ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
          {messages.length === 0 && !isCapturing && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-10 max-w-4xl mx-auto py-10">
              
              {/* NEW: Medical Scanner Section Card */}
              <div className="w-full bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                 <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />
                 <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="shrink-0 relative">
                       <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 shadow-inner group-hover:border-emerald-500/50 transition-all">
                          <Scan size={64} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                       </div>
                       <div className="absolute -top-2 -right-2 p-2 bg-indigo-600 rounded-full text-white animate-bounce shadow-lg">
                          <Sparkles size={16} />
                       </div>
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-4">
                       <h2 className="text-3xl font-black text-slate-100 italic tracking-tighter">AI Medical Scanner</h2>
                       <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                          Utilize deep multimodal vision for instant physiological screening. Capture high-fidelity photos or motion sequences for clinical-grade AI ingestion.
                       </p>
                       <button 
                        onClick={startCamera}
                        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
                       >
                         <Camera size={18} /> Launch Scanner HUD
                       </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">AI Diagnostic Scenarios</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                  {[
                    { text: "Analyze skin lesion for irregularities", icon: <Microscope size={14} />, category: 'Visual Scan' },
                    { text: "Evaluate eye redness/irritation", icon: <Eye size={14} />, category: 'Optical Scan' },
                    { text: "Symptoms of chronic joint swelling", icon: <Bone size={14} />, category: 'Orthopedics' },
                    { text: "Managing anxiety and stress levels", icon: <Brain size={14} />, category: 'Mental Health' }
                  ].map((s, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSend(s.text)} 
                      className="flex flex-col gap-3 p-4 bg-slate-900 border border-slate-800 rounded-3xl hover:border-emerald-500/50 hover:bg-slate-800 transition-all text-left group shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-slate-800 rounded-xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          {s.icon}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">{s.category}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 leading-tight group-hover:text-slate-200 transition-colors">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const confidence = m.role === 'model' ? parseConfidence(m.content) : null;
            return (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start animate-in fade-in slide-in-from-bottom-2'}`}>
                <div className={`max-w-[90%] md:max-w-[80%] rounded-[3rem] overflow-hidden shadow-2xl relative ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-white/5'}`}>
                  {m.role === 'model' && (
                    <div className="px-8 py-4 bg-slate-950/50 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => handleReadAloud(m.content, i)}
                          disabled={isSpeakingId !== null}
                          className={`p-2.5 rounded-xl transition-all ${isSpeakingId === i ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                          title="Read Diagnostic Aloud"
                        >
                          {isSpeakingId === i ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                        </button>
                        <div className="flex items-center gap-3">
                          <ShieldCheck size={18} className={confidence && confidence > 75 ? 'text-emerald-400' : confidence && confidence > 50 ? 'text-amber-400' : 'text-red-400'} />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Certainty Index</span>
                        </div>
                      </div>
                      {confidence !== null && (
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full transition-all duration-1000 ${confidence > 75 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : confidence > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${confidence}%` }} />
                          </div>
                          <span className={`text-sm font-mono font-black ${confidence > 75 ? 'text-emerald-400' : confidence > 50 ? 'text-amber-400' : 'text-red-400'}`}>{confidence}%</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-8 md:p-10 space-y-8">
                    {m.imageUrl && (
                      <div className="mb-6 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl max-w-sm ring-4 ring-indigo-500/10">
                        <img src={m.imageUrl} alt="Clinical Visual" className="w-full h-auto" />
                      </div>
                    )}
                    <div className="space-y-10">
                      {m.content.split('###').filter(s => s.trim()).map((section, idx) => {
                        const title = section.split('\n')[0].trim();
                        const body = section.split('\n').slice(1).join('\n').trim();
                        if (title.includes('1. CLINICAL ANALYSIS')) return (
                          <div key={idx} className="space-y-4">
                            <h4 className="flex items-center gap-3 text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]"><Search size={16} /> Clinical Analysis</h4>
                            <div className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-800/30 p-6 rounded-[1.5rem] border border-white/5 italic">"{body}"</div>
                          </div>
                        );
                        if (title.includes('2. POTENTIAL CONDITIONS')) return (
                          <div key={idx} className="space-y-4">
                            <h4 className="flex items-center gap-3 text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px]"><Activity size={16} /> Potential Considerations</h4>
                            <div className="grid grid-cols-1 gap-3">
                              {body.split('- ').filter(b => b.trim()).map((cond, cidx) => (
                                <div key={cidx} className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-3xl flex items-start gap-4">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                  <span className="text-sm text-slate-300 font-bold leading-normal">{cond}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                        if (title.includes('3. RECOMMENDED NEXT STEPS')) return (
                          <div key={idx} className="space-y-4">
                            <h4 className="flex items-center gap-3 text-amber-400 font-black uppercase tracking-[0.3em] text-[10px]"><ClipboardList size={16} /> Recommended Actions</h4>
                            <div className="grid grid-cols-1 gap-3">
                              {body.split('- ').filter(b => b.trim()).map((step, sidx) => (
                                <div key={sidx} className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-3xl flex items-start gap-4">
                                  <div className="p-1 bg-amber-500/20 rounded-md text-amber-500 shrink-0"><CheckCircle2 size={12} /></div>
                                  <span className="text-sm text-slate-300 font-medium leading-normal">{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                        if (title.includes('5. MEDICAL DISCLAIMER')) return (
                          <div key={idx} className="p-8 bg-red-500/10 border border-red-500/30 rounded-[2rem] flex flex-col gap-4 shadow-xl">
                            <div className="flex items-center gap-3 text-red-400 font-black uppercase tracking-[0.3em] text-[11px]"><AlertTriangle size={20} /> Clinical Protocol & Disclaimer</div>
                            <p className="text-[12px] text-red-100/80 leading-relaxed font-bold tracking-tight italic">{body}</p>
                            <div className="flex items-center gap-2 mt-2 pt-4 border-t border-red-500/20">
                              <Info size={14} className="text-red-400" />
                              <span className="text-[10px] text-red-300 uppercase font-black tracking-widest mr-auto">Awaiting Physician Verification</span>
                              <a href={symptomCheckerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-red-400 hover:text-white transition-colors flex items-center gap-1">
                                <ExternalLink size={10} /> Mayo Clinic Tool
                              </a>
                            </div>
                          </div>
                        );
                        if (title.includes('4. CONFIDENCE SCORE')) return null;
                        return <div key={idx} className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{section}</div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-900 rounded-[2.5rem] px-8 py-6 border border-white/5 flex items-center gap-5 shadow-2xl animate-pulse">
                <Loader2 className="animate-spin text-emerald-400" size={24} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Diagnosis Engine</span>
                  <span className="text-sm text-slate-400 font-bold italic">Filtering clinical datasets...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Archive UI */}
        {showHistory && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl z-40 p-10 flex flex-col animate-in fade-in slide-in-from-right-10 duration-500">
            <div className="flex items-center justify-between mb-10">
              <h4 className="text-3xl font-black italic tracking-tighter flex items-center gap-4">
                <History className="text-indigo-400" /> Clinical Archives
              </h4>
              <button onClick={() => setShowHistory(false)} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all shadow-xl text-slate-300">
                <X size={20} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl w-fit border border-slate-800">
              <button 
                onClick={() => setHistoryFilter('active')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${historyFilter === 'active' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setHistoryFilter('archived')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${historyFilter === 'archived' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Archived
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
              {filteredSessions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-6">
                   <Filter size={80} strokeWidth={1} />
                   <p className="text-2xl font-black uppercase tracking-[0.2em]">No {historyFilter} sessions found</p>
                </div>
              ) : (
                filteredSessions.map((s) => (
                  <div 
                    key={s.id} 
                    onClick={() => loadSession(s)}
                    className={`group relative p-8 bg-slate-900/80 border rounded-[2.5rem] cursor-pointer transition-all flex items-center justify-between hover:scale-[1.02] ${currentSessionId === s.id ? 'border-indigo-500 bg-indigo-500/10 shadow-2xl' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900'}`}
                  >
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {new Date(s.timestamp).toLocaleDateString()} at {new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {s.isArchived && <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">Archived</span>}
                      </div>

                      {editingSessionId === s.id ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            autoFocus
                            value={editingTitle} 
                            onChange={e => setEditingTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveRename(e)}
                            className="bg-slate-950 border border-indigo-500 rounded-xl px-4 py-2 text-sm font-bold text-white outline-none w-full max-w-sm"
                          />
                          <button onClick={saveRename} className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500"><Check size={16} /></button>
                          <button onClick={() => setEditingSessionId(null)} className="p-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700"><X size={16} /></button>
                        </div>
                      ) : (
                        <h5 className="text-xl font-black text-slate-200 truncate italic">{s.title}</h5>
                      )}
                      
                      <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest flex items-center gap-2">
                         <MessageSquare size={12} className="text-indigo-400" /> {s.messages.length} Interactions
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                       <button 
                        onClick={(e) => startRenaming(s, e)}
                        className="p-4 bg-slate-800 hover:bg-indigo-600 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                        title="Rename Record"
                       >
                         <Edit2 size={18} />
                       </button>
                       <button 
                        onClick={(e) => toggleArchive(s.id, e)}
                        className={`p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl text-white ${s.isArchived ? 'bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white' : 'bg-slate-800 hover:bg-amber-600'}`}
                        title={s.isArchived ? "Unarchive" : "Archive"}
                       >
                         {s.isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                       </button>
                       <button 
                        onClick={(e) => deleteSession(s.id, e)}
                        className="p-4 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                        title="Delete Record"
                       >
                         <Trash2 size={18} />
                       </button>
                       <ChevronRight className={`ml-2 transition-transform group-hover:translate-x-1 ${currentSessionId === s.id ? 'text-indigo-400' : 'text-slate-700'}`} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input UI */}
      <div className="p-6 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 relative z-40">
        {uploadProgress !== null && (
          <div className="mb-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                <RefreshCw size={12} className="animate-spin" /> Ingesting Clinical Media...
              </div>
              <span className="text-[10px] font-mono font-black text-slate-500">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {attachedMedia && (
          <div className="mb-4 flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-4 rounded-3xl border border-emerald-500/30 animate-in zoom-in duration-200 max-w-2xl shadow-2xl relative overflow-hidden group">
            {/* Asset Preview with Scanning Effect */}
            <div className="w-full sm:w-32 h-32 bg-slate-900 rounded-2xl overflow-hidden shrink-0 relative">
              {attachedMedia.type === 'image' ? (
                <>
                  <img src={`data:image/png;base64,${attachedMedia.data}`} className="w-full h-full object-cover" alt="Attached Clinical" />
                  <div className="absolute inset-x-0 h-0.5 bg-emerald-400/50 shadow-[0_0_10px_#10b981] animate-[scan_2s_linear_infinite]" />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-emerald-500/30">
                  <Video size={40} />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden space-y-1">
               <span className="text-xs font-black text-slate-300 block truncate uppercase tracking-tight">{attachedMedia.name}</span>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Asset Ready for Multimodal Screening</span>
               </div>
               
               <div className="flex items-center gap-2 mt-4">
                  {attachedMedia.type === 'image' ? (
                    <button 
                      onClick={() => handleSend("Perform a comprehensive multimodal clinical analysis of this image. Identify any visible health markers, skin irregularities, ocular indicators, or physiological anomalies. Provide structured clinical observations.")}
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles size={14} className="animate-pulse" /> Initiate Smart Clinical Scan
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSend("Analyze this video sequence for any visible health-related patterns, tremors, or symptoms visible in movement/posture.")}
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Microscope size={14} /> Motion Analysis
                    </button>
                  )}
                  <button onClick={() => setAttachedMedia(null)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors shadow-lg">
                    <X size={16} />
                  </button>
               </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex items-center gap-3 bg-slate-950 border border-slate-700 focus-within:border-emerald-500/50 rounded-[2.5rem] p-2 transition-all shadow-2xl ring-1 ring-white/5">
          <div className="flex gap-1 pl-2">
             <button 
              onClick={isCapturing ? closeCamera : startCamera} 
              title="Medical Scanner HUD" 
              className={`p-4 rounded-2xl transition-all ${isCapturing ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : uploadProgress !== null ? 'opacity-20 cursor-not-allowed' : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-900 active:scale-95'}`}
             >
                <Scan size={24} />
             </button>
             <label className={`p-4 rounded-2xl cursor-pointer transition-all ${uploadProgress !== null ? 'opacity-20 cursor-not-allowed' : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-900 active:scale-95'}`}>
                <ImageIcon size={24} />
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
             </label>
             <label className={`p-4 rounded-2xl cursor-pointer transition-all ${uploadProgress !== null ? 'opacity-20 cursor-not-allowed' : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-900 active:scale-95'}`}>
                <VideoIcon size={24} />
                <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} />
             </label>
          </div>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Direct your health query or provide diagnostic media..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-4 px-3 outline-none text-slate-200 placeholder:text-slate-700 font-bold"
          />
          <button onClick={() => handleSend()} disabled={isLoading || uploadProgress !== null || (!input.trim() && !attachedMedia)} className="p-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-full transition-all shadow-2xl shadow-emerald-900/40 active:scale-95 flex items-center justify-center min-w-[64px] h-[64px]">
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Health;