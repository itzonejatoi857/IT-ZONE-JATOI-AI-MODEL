import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, Volume2, Loader2, Play, Eraser, Languages, FileText, Clipboard, Square, Globe, Upload, FileUp, History, Trash2, Clock, CheckCircle2, Save } from 'lucide-react';
import { decode, decodeAudioData } from '../services/audioService';

interface STTHistoryItem {
  id: string;
  text: string;
  language: string;
  timestamp: number;
}

const Utilities: React.FC = () => {
  const [ttsText, setTtsText] = useState('');
  const [sttResult, setSttResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<STTHistoryItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const languages = [
    'English', 'Urdu', 'Arabic', 'Spanish', 'French', 
    'German', 'Chinese (Simplified)', 'Chinese (Traditional)', 
    'Japanese', 'Russian', 'Hindi', 'Italian', 'Portuguese', 
    'Korean', 'Turkish', 'Vietnamese', 'Thai', 'Dutch', 
    'Polish', 'Indonesian', 'Persian', 'Bengali', 'Punjabi', 
    'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Malayalam', 
    'Kannada', 'Ukrainian', 'Greek', 'Swedish', 'Norwegian', 
    'Danish', 'Finnish', 'Hebrew', 'Romanian', 'Hungarian', 
    'Czech', 'Slovak'
  ];

  // Load history and last TTS prompt on mount
  useEffect(() => {
    const savedSTT = localStorage.getItem('it_zone_stt_history');
    if (savedSTT) {
      try {
        setHistory(JSON.parse(savedSTT));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedTTS = localStorage.getItem('it_zone_last_tts_prompt');
    if (savedTTS) {
      setTtsText(savedTTS);
    }
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem('it_zone_stt_history', JSON.stringify(history));
  }, [history]);

  // Debounced auto-save for TTS prompt
  useEffect(() => {
    if (!ttsText) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      localStorage.setItem('it_zone_last_tts_prompt', ttsText);
      setSaveStatus('saved');
      
      const resetTimer = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
      
      return () => clearTimeout(resetTimer);
    }, 800);

    return () => clearTimeout(timer);
  }, [ttsText]);

  const handleTTS = async () => {
    if (!ttsText) return;
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsText }] }],
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
        source.start();
      }
    } catch (err) {
      console.error(err);
      alert("TTS failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await performSTT(base64Audio, 'audio/webm');
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      setIsListening(true);
    } catch (err) {
      console.error(err);
    }
  };

  const stopListening = () => {
    mediaRecorderRef.current?.stop();
    setIsListening(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    reader.onload = async () => {
      const base64Audio = (reader.result as string).split(',')[1];
      setUploadProgress(null);
      setIsProcessing(true);
      await performSTT(base64Audio, file.type);
    };

    reader.onerror = () => {
      setUploadProgress(null);
      console.error("FileReader error");
    };

    reader.readAsDataURL(file);
  };

  const performSTT = async (base64Data: string, mimeType: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: `Transcribe this audio accurately and translate it into ${targetLanguage}. Return both original and translation if possible, or just the translation if it's more concise.` }
          ]
        }
      });
      const resultText = response.text || "Could not transcribe.";
      setSttResult(resultText);

      // Auto-save to history
      if (resultText && resultText !== "Could not transcribe.") {
        const newItem: STTHistoryItem = {
          id: crypto.randomUUID(),
          text: resultText,
          language: targetLanguage,
          timestamp: Date.now()
        };
        setHistory(prev => [newItem, ...prev].slice(0, 20)); // Keep last 20
      }
    } catch (err) {
      console.error(err);
      setSttResult("Transcription error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = () => {
    if (confirm("Clear all transcription history?")) {
      setHistory([]);
    }
  };

  const recallHistory = (item: STTHistoryItem) => {
    setSttResult(item.text);
    setTargetLanguage(item.language);
    setShowHistory(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* TTS Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Volume2 size={120} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-900/40">
              <Volume2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Text-to-Speech</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Gemini 2.5 TTS</p>
            </div>
          </div>
          
          {/* Save Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-500 border ${saveStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 opacity-100 translate-y-0' : saveStatus === 'saving' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
             {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
             <span className="text-[10px] font-black uppercase tracking-widest">
               {saveStatus === 'saving' ? 'Syncing...' : 'Draft Saved'}
             </span>
          </div>
        </div>

        <div className="relative group">
          <textarea 
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Type something for Gemini to say..."
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none h-48 no-scrollbar transition-all"
          />
          {ttsText && (
            <button 
              onClick={() => setTtsText('')}
              className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Clear Prompt"
            >
              <Eraser size={14} />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <button 
            onClick={handleTTS}
            disabled={isProcessing || !ttsText}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/40 active:scale-95"
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} />}
            Synthesize Audio
          </button>
          <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <Save size={10} className="text-indigo-500" />
            Prompt is automatically persisted for your next session.
          </p>
        </div>
      </section>

      {/* STT Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden flex flex-col">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Mic size={120} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-900/40">
              <Mic size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Smart Transcription</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">STT & Translation Hub</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-3 rounded-xl transition-all ${showHistory ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            title="View History"
          >
            <History size={20} />
          </button>
        </div>

        <div className="relative group flex-1 min-h-[16rem]">
          {showHistory ? (
            <div className="absolute inset-0 bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 z-10">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Recent Sessions</span>
                {history.length > 0 && (
                  <button onClick={clearAllHistory} className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 size={12} /> Clear All
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-6">
                    <Clock size={32} className="mb-2" />
                    <p className="text-xs font-bold uppercase tracking-tighter">No History Yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => recallHistory(item)}
                      className="group/item relative p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                          {item.language}
                        </span>
                        <span className="text-[9px] font-mono text-slate-600">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.text}</p>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm h-full whitespace-pre-wrap overflow-y-auto no-scrollbar relative">
              {isProcessing && !sttResult ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3 py-12">
                  <div className="relative">
                    <Loader2 className="animate-spin text-emerald-400" size={40} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Neural Synthesis Active</span>
                </div>
              ) : sttResult ? (
                <div className="space-y-4">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
                     <CheckCircle2 size={12} /> Results Ready
                   </div>
                   <div className="text-slate-300 leading-relaxed font-medium">{sttResult}</div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 py-12 opacity-40">
                  <FileText size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest">Awaiting Audio Stream</p>
                </div>
              )}
            </div>
          )}
          
          {sttResult && !isProcessing && !showHistory && (
             <div className="absolute top-2 right-2 flex gap-2 animate-in fade-in duration-300">
                <button onClick={() => { copyToClipboard(sttResult); alert('Copied!'); }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                  <Clipboard size={14} />
                </button>
                <button onClick={() => setSttResult('')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                  <Eraser size={14} />
                </button>
             </div>
          )}
        </div>

        <div className="space-y-4">
          {uploadProgress !== null && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-400">
                <div className="flex items-center gap-1"><FileUp size={10} /> Reading Waveforms...</div>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 shadow-inner focus-within:border-indigo-500 transition-colors">
              <Globe size={16} className="text-indigo-400" />
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter shrink-0">Output Lang:</label>
              <select 
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold focus:ring-0 outline-none flex-1 text-slate-300 cursor-pointer"
              >
                {languages.map(lang => (
                  <option key={lang} value={lang} className="bg-slate-900 text-slate-300">{lang}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing || uploadProgress !== null}
              className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${isListening ? 'bg-red-500 shadow-red-900/40 animate-pulse text-white' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white'}`}
            >
              {isListening ? (
                <><Square size={18} /> End Stream</>
              ) : (
                <><Mic size={18} /> Record Live</>
              )}
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isListening || uploadProgress !== null}
              className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/30 active:scale-95"
            >
              <Upload size={18} /> Import Audio
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="audio/*" 
              onChange={handleFileChange} 
            />
          </div>
        </div>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-3 mt-auto">
           <Languages className="text-emerald-500 shrink-0" size={18} />
           <p className="text-[10px] text-slate-400 font-medium">History is stored locally. Clear browser data to reset.</p>
        </div>
      </section>
    </div>
  );
};

export default Utilities;