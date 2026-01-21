import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Sparkles, Download, Layers, Wand2, Loader2, Maximize, Trash2, Image as ImageIcon, Palmtree, Mountain, Building2, User, Ghost, ExternalLink, Info } from 'lucide-react';
import { AspectRatio, ImageSize } from '../types';

const ImageStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQR);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleBaseImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBaseImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const checkApiKey = async () => {
    if (!(await (window as any).aistudio?.hasSelectedApiKey())) {
      await (window as any).aistudio?.openSelectKey();
    }
  };

  const generateImage = async (suggestedPrompt?: string) => {
    const activePrompt = suggestedPrompt || prompt;
    if (!activePrompt) return;
    
    await checkApiKey();
    
    if (suggestedPrompt) setPrompt(suggestedPrompt);
    
    setIsGenerating(true);
    setIsEditing(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: activePrompt }] },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        alert("Advanced Image Generation requires a paid API key. Please select a valid key from a paid project.");
        await (window as any).aistudio?.openSelectKey();
      } else {
        alert("Failed to generate image. Ensure you have a valid Pro API key selected.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const editImage = async () => {
    if (!prompt || !baseImage) return;
    setIsGenerating(true);
    setIsEditing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = baseImage.split(',')[1];
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: prompt }
          ]
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to edit image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const suggestions = [
    { text: "Futuristic cyberpunk neon cityscape", icon: <Building2 size={16} /> },
    { text: "Epic fantasy landscape with floating islands", icon: <Mountain size={16} /> },
    { text: "Hyper-realistic portrait of a robotic knight", icon: <User size={16} /> },
    { text: "Surreal abstract dreamscape with clocks", icon: <Ghost size={16} /> },
    { text: "Serene tropical beach at sunset, 8k", icon: <Palmtree size={16} /> }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* Sidebar / Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="text-indigo-400" size={20} /> Creative Controls
            </h3>
            <button 
              onClick={() => (window as any).aistudio?.openSelectKey()} 
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400" 
              title="Change API Key"
            >
              <ExternalLink size={16} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl mb-4">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Info size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Premium Model Notice</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Gemini 3 Pro Image requires a paid project API key.
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 text-indigo-400 underline hover:text-indigo-300"
                >
                  Billing Docs
                </a>
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-2">Prompt Strategy</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A high-fantasy portrait of a robotic knight, neon lighting, cinematic..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none h-32 no-scrollbar"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-2">Aspect Ratio</label>
                <select 
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none"
                >
                  {Object.values(AspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-2">Resolution</label>
                <select 
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as ImageSize)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none"
                >
                  {Object.values(ImageSize).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <button 
                onClick={() => generateImage()}
                disabled={isGenerating || !prompt}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/30"
              >
                {isGenerating && !isEditing ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                Generate New
              </button>
              
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleBaseImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <button className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all">
                  <ImageIcon size={20} /> {baseImage ? 'Change Reference' : 'Upload for Edit'}
                </button>
              </div>

              {baseImage && (
                <button 
                  onClick={editImage}
                  disabled={isGenerating || !prompt}
                  className="w-full bg-violet-600 hover:bg-violet-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-900/30"
                >
                  {isGenerating && isEditing ? <Loader2 className="animate-spin" size={20} /> : <Layers size={20} />}
                  Apply Edit to Upload
                </button>
              )}
            </div>
          </div>
        </div>

        {baseImage && (
          <div className="relative group overflow-hidden rounded-2xl border border-slate-700 aspect-square shadow-xl">
            <img src={baseImage} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Reference" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={() => setBaseImage(null)} className="p-3 bg-red-500 text-white rounded-full shadow-xl">
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="lg:col-span-8 h-full">
        <div className="h-full min-h-[500px] bg-slate-900/50 border border-slate-800 border-dashed rounded-[3.5rem] p-8 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700">
          {generatedImageUrl ? (
            <>
              <div className="w-full h-full flex items-center justify-center rounded-[2.5rem] overflow-hidden bg-slate-950 shadow-2xl relative">
                <img src={generatedImageUrl} className="max-w-full max-h-full object-contain animate-in zoom-in duration-500" alt="Generated" />
              </div>
              <div className="absolute bottom-12 flex gap-4">
                <a 
                  href={generatedImageUrl} 
                  download="gemini-gen.png"
                  className="bg-white text-black px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-2xl active:scale-95"
                >
                  <Download size={18} /> Export ( {imageSize} )
                </a>
                <button 
                  onClick={() => setGeneratedImageUrl(null)}
                  className="bg-slate-800/80 backdrop-blur-md text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Trash2 size={18} /> Discard
                </button>
              </div>
            </>
          ) : (
            <div className="w-full max-w-2xl space-y-10 py-12">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-inner">
                  <ImageIcon size={40} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Image Studio Hub</h2>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">Select a category or enter a custom prompt to synthesize visuals.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((s, i) => (
                  <button 
                    key={i} 
                    onClick={() => generateImage(s.text)} 
                    className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-800 transition-all text-left group"
                  >
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      {s.icon}
                    </div>
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {isGenerating && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-500/20 rounded-full animate-ping absolute inset-0" />
                <Loader2 className="animate-spin text-indigo-400" size={80} />
              </div>
              <p className="text-indigo-400 font-black text-xs uppercase tracking-widest animate-pulse">Engaging Neural Engine v3.1...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageStudio;