
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Mic, MicOff, Volume2, AudioLines, Square, Loader2, MessageSquare, UserCircle, Trash2, RefreshCw, Activity, Wifi, WifiOff, AlertCircle, Radio, Waves } from 'lucide-react';
import { decode, encode, decodeAudioData, blobToBase64 } from '../services/audioService';

const VoiceHub: React.FC = () => {
  const [isLive, setIsLive] = useState(false);
  const [transcription, setTranscription] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'Offline' | 'Connecting' | 'Online'>('Offline');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  
  // Voice Cloning State
  const [isRecordingClone, setIsRecordingClone] = useState(false);
  const [voiceCloneBase64, setVoiceCloneBase64] = useState<string | null>(null);
  const [cloneStatus, setCloneStatus] = useState<'empty' | 'ready'>('empty');

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);
  const speakingTimeoutRef = useRef<number | null>(null);
  
  // Recorder Ref for Cloning
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Auto-scroll transcription
  useEffect(() => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcription]);

  const startCloning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const base64 = await blobToBase64(blob);
        setVoiceCloneBase64(base64);
        setCloneStatus('ready');
        setIsRecordingClone(false);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingClone(true);
      
      // Auto-stop after 8 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 8000);
    } catch (err) {
      console.error("Cloning Error", err);
    }
  };

  const clearClone = () => {
    setVoiceCloneBase64(null);
    setCloneStatus('empty');
  };

  const startLiveSession = async () => {
    try {
      setIsProcessing(true);
      setStatus('Connecting');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const customInstruction = voiceCloneBase64 
        ? "You are an AI that has been provided with an audio sample of my voice. Analyze my tone, personality, and linguistic patterns from that sample and emulate them in your responses. Be my charismatic digital twin."
        : "You are a helpful and charismatic AI assistant named Gemini. Be conversational and concise.";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("Session Opened");
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            
            if (voiceCloneBase64) {
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: voiceCloneBase64, mimeType: 'audio/webm' }
                });
              });
            }

            setIsLive(true);
            setIsProcessing(false);
            setStatus('Online');
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
              // Clear user speaking state when AI starts responding
              setIsUserSpeaking(false);
              if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setTranscription(prev => [...prev, { role: 'ai', text }]);
            }
            if (message.serverContent?.inputTranscription) {
              setIsUserSpeaking(true);
              const text = message.serverContent.inputTranscription.text;
              setTranscription(prev => [...prev, { role: 'user', text }]);
              
              // Maintain speaking state for a moment after last chunk
              if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
              speakingTimeoutRef.current = window.setTimeout(() => setIsUserSpeaking(false), 1500);
            }

            if (message.serverContent?.turnComplete) {
              setIsUserSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error("Live Error", e);
            stopLiveSession();
          },
          onclose: () => stopLiveSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: customInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setStatus('Offline');
    }
  };

  const stopLiveSession = () => {
    sessionRef.current?.close?.();
    streamRef.current?.getTracks().forEach(t => t.stop());
    inputAudioContextRef.current?.close();
    audioContextRef.current?.close();
    setIsLive(false);
    setIsProcessing(false);
    setStatus('Offline');
    setIsUserSpeaking(false);
    if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
  };

  const getStatusConfig = () => {
    switch(status) {
      case 'Online':
        return {
          icon: <Wifi size={14} className="text-emerald-400" />,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          dot: 'bg-emerald-400 animate-pulse',
          text: 'Session Active'
        };
      case 'Connecting':
        return {
          icon: <RefreshCw size={14} className="text-amber-400 animate-spin" />,
          color: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          dot: 'bg-amber-400 animate-pulse',
          text: 'Establishing Protocol'
        };
      default:
        return {
          icon: <WifiOff size={14} className="text-slate-500" />,
          color: 'text-slate-500',
          bg: 'bg-slate-800',
          border: 'border-slate-700',
          dot: 'bg-slate-600',
          text: 'Link Disconnected'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-12">
      {/* Sidebar: Voice Cloning Controls */}
      <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <UserCircle className="text-indigo-400" size={24} />
            <h3 className="text-xl font-bold">Voice Identity</h3>
          </div>
          
          <div className={`
            relative p-6 rounded-3xl border-2 border-dashed transition-all duration-300 mb-6 flex flex-col items-center text-center
            ${isRecordingClone ? 'border-red-500 bg-red-500/5' : cloneStatus === 'ready' ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800 bg-slate-950'}
          `}>
            {isRecordingClone ? (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-red-500 rounded-full animate-pulse mx-auto" />
                <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Recording Sample...</p>
                <p className="text-xs text-slate-500">Speak clearly for 8 seconds</p>
              </div>
            ) : cloneStatus === 'ready' ? (
              <div className="space-y-4">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400">
                  <AudioLines size={24} />
                </div>
                <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Clone Profile Active</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={startCloning} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Re-record">
                    <RefreshCw size={16} />
                  </button>
                  <button onClick={clearClone} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" title="Delete Clone">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Record a sample to create your AI digital twin.</p>
                <button 
                  onClick={startCloning}
                  className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Clone My Voice
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">How it works</h4>
            <ul className="text-[11px] text-slate-500 space-y-2 px-2 leading-relaxed">
              <li className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                Audio sample is analyzed for tone and vocabulary.
              </li>
              <li className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                Gemini adjusts its "persona" to match your identity.
              </li>
              <li className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                Style is applied instantly when session starts.
              </li>
            </ul>
          </div>
        </div>

        {/* Status Indicators Overlay */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 space-y-4 shadow-xl">
           <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
             <Activity size={12} className="text-indigo-400" /> System Diagnostics
           </h4>
           <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold transition-colors duration-300 ${statusConfig.color}`}>
                    {status}
                  </span>
                  {statusConfig.icon}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Latency</span>
                <span className="text-slate-300 font-mono">{isLive ? '< 150ms' : '--'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Protocol</span>
                <span className="text-slate-300 font-mono">WebRTC / PCM</span>
              </div>
           </div>
        </div>
      </div>

      {/* Main Panel: Conversation */}
      <div className="lg:col-span-8 flex flex-col items-center justify-center space-y-8 order-1 lg:order-2">
        <div className="text-center space-y-4 w-full relative">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 animate-in fade-in slide-in-from-top-4 duration-500 transition-all ${statusConfig.bg} ${statusConfig.border}`}>
             <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
             <span className={`text-[10px] font-black uppercase tracking-widest ${statusConfig.color}`}>
               {statusConfig.text}
             </span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            Conversational Hub
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto">
            {cloneStatus === 'ready' 
              ? "Digital Twin Mode Active. AI will mimic your personality."
              : "Natural real-time interaction powered by Gemini Native Audio."}
          </p>
        </div>

        <div className="relative group">
          {/* AI Active Indicator (Inner Ping) */}
          {isLive && !isUserSpeaking && (
            <div className="absolute inset-0 -m-12 flex items-center justify-center pointer-events-none opacity-50">
              <div className="w-full h-full border-[12px] border-indigo-500/20 rounded-full animate-ping" />
              <div className="absolute w-4/5 h-4/5 border-[12px] border-emerald-500/10 rounded-full animate-ping delay-700" />
            </div>
          )}

          {/* User Speaking Indicator (Outer Waveform Ring) */}
          {isUserSpeaking && (
            <div className="absolute inset-0 -m-16 flex items-center justify-center pointer-events-none">
              <div className="w-full h-full border-[4px] border-emerald-500/40 rounded-full animate-[pulse_1.5s_infinite] scale-110" />
              <div className="absolute inset-0 -m-20 border-[2px] border-emerald-400/20 rounded-full animate-[pulse_2s_infinite] scale-125" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg animate-bounce">
                <Waves size={10} className="animate-pulse" /> User Transcribing
              </div>
            </div>
          )}
          
          <button
            onClick={isLive ? stopLiveSession : startLiveSession}
            disabled={isProcessing || isRecordingClone}
            className={`
              relative z-10 w-64 h-64 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl
              ${isLive 
                ? isUserSpeaking 
                  ? 'bg-emerald-600 shadow-emerald-900/40 border-8 border-emerald-400/30'
                  : 'bg-red-500 hover:bg-red-600 shadow-red-900/40 border-8 border-red-400/30' 
                : status === 'Connecting'
                  ? 'bg-amber-500 shadow-amber-900/40 border-8 border-amber-400/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40 border-8 border-indigo-400/30 hover:scale-105'}
              disabled:opacity-50
            `}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-white" size={64} />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Establishing...</span>
              </div>
            ) : isLive ? (
              <>
                {isUserSpeaking ? <AudioLines size={64} className="text-white mb-2 animate-pulse" /> : <Square size={64} className="text-white mb-2" />}
                <span className="text-sm font-black uppercase tracking-widest text-white/90">
                  {isUserSpeaking ? "Transcribing..." : "Disconnect"}
                </span>
              </>
            ) : (
              <>
                <Mic size={64} className="text-white mb-2 transition-transform group-hover:scale-110" />
                <span className="text-sm font-black uppercase tracking-widest text-white/90">Start Call</span>
              </>
            )}
          </button>
          
          {/* Status badge floating near button on mobile */}
          <div className="lg:hidden mt-8 text-center">
             <span className={`text-[10px] font-black uppercase tracking-widest ${statusConfig.color} px-4 py-2 bg-slate-900/80 rounded-full border border-slate-800`}>
                {status}
             </span>
          </div>
        </div>

        {/* Enhanced Transcription Display */}
        <div className="w-full bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl flex flex-col h-[400px]">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/50">
            <MessageSquare size={20} className="text-indigo-400" />
            <h3 className="font-bold text-slate-300">Live Feed</h3>
            {isUserSpeaking && (
              <div className="ml-4 flex items-center gap-2 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Processing Voice Input...</span>
              </div>
            )}
            <div className={`ml-auto px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 border transition-all duration-500 ${statusConfig.bg} ${statusConfig.border} ${statusConfig.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
              {status}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-2">
            {transcription.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30">
                {status === 'Online' ? (
                  <Radio size={40} className="text-emerald-400 animate-pulse" />
                ) : (
                  <AudioLines size={40} className="text-slate-600 animate-pulse" />
                )}
                <p className="text-sm font-medium text-slate-500">
                  {status === 'Online' ? 'Active session. AI is listening...' : 'Link idle. Start a call to begin.'}
                </p>
              </div>
            ) : (
              transcription.map((item, i) => (
                <div 
                  key={i} 
                  className={`flex flex-col ${item.role === 'ai' ? 'items-start' : 'items-end'}`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${item.role === 'ai' ? 'text-indigo-400 ml-2' : 'text-emerald-400 mr-2'}`}>
                    {item.role === 'ai' ? 'Gemini AI' : 'You'}
                  </span>
                  <div 
                    className={`p-4 rounded-[1.5rem] max-w-[85%] text-sm font-medium animate-in slide-in-from-bottom-4 duration-500 ${item.role === 'ai' ? 'bg-slate-800/80 text-indigo-100 rounded-tl-none border border-white/5 shadow-lg' : 'bg-indigo-600/20 text-emerald-100 rounded-tr-none border border-emerald-500/20 shadow-lg'}`}
                  >
                    {item.text}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptionEndRef} />
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6 opacity-40 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-800"><AudioLines size={12} /> Full Duplex</div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-800"><Volume2 size={12} /> Neural Synthesis</div>
          <div className={`flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-800 transition-colors ${isLive ? 'text-emerald-400 border-emerald-500/20' : ''}`}><MicOff size={12} /> Low Latency</div>
        </div>
      </div>
    </div>
  );
};

export default VoiceHub;
