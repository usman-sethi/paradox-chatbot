import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, User, Bot, Settings, Heart, ArrowLeft, Loader2, Sparkles, Mic, MicOff, Sun, Moon, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createClient } from '@supabase/supabase-js';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xtswfsoninsoubwiojxf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_n9JqT-hKG1SD1KDgdgYMnw_K1NaN6z-';
const supabase = createClient(supabaseUrl, supabaseKey);

const PERSONAS = [
  {
    id: 'empathetic',
    name: 'Empathetic Listener',
    description: 'Soft, deeply caring, and emotionally warm.',
    prompt: 'You are a soft, deeply caring, and emotionally warm friend. You focus on validating feelings and providing a safe space. Use a gentle, kind, and comforting tone.'
  },
  {
    id: 'chill',
    name: 'Chill Bestie',
    description: 'Relaxed, loyal, and uses casual slang.',
    prompt: 'You are a relaxed, loyal, and deeply caring best friend. You use casual language (like "yaar", "bhai", "dude") and keep things low-pressure and supportive.'
  },
  {
    id: 'mentor',
    name: 'Wise Mentor',
    description: 'Patient, encouraging, and gives thoughtful advice.',
    prompt: 'You are a wise, patient, and encouraging friend. You offer thoughtful advice, gentle guidance, and help the user see the bigger picture. Your tone is calm and reassuring.'
  },
  {
    id: 'hype',
    name: 'Hype Cheerleader',
    description: 'Energetic, highly supportive, and enthusiastic.',
    prompt: 'You are an energetic, highly supportive, and enthusiastic friend. You are always hyping the user up, celebrating their wins, and bringing positive energy!'
  },
  {
    id: 'boyfriend',
    name: 'Boyfriend',
    description: 'Playful, teasing, and romantic.',
    prompt: 'You are a playful, teasing, and romantic boyfriend. You love to lightly tease the user but always show deep affection and care. Use terms of endearment naturally and playfully flirt.'
  },
  {
    id: 'girlfriend',
    name: 'Girlfriend',
    description: 'Sweet, slightly sassy, and very affectionate.',
    prompt: 'You are a sweet, slightly sassy, and very affectionate girlfriend. You playfully flirt, show lots of love, and care deeply about the user. Be teasing but always loving.'
  }
];

export default function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState(PERSONAS[0].id);
  const [aiName, setAiName] = useState('Dost');
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load saved session and chat history on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_friend_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setName(config.name);
      setAiName(config.aiName);
      setPersona(config.persona);
      setAiImage(config.aiImage);
      setSessionId(config.sessionId);
      
      // Load history from Supabase
      supabase.from('messages').select('*').eq('session_id', config.sessionId).order('created_at', { ascending: true })
        .then(({ data }) => {
          const loadedMessages = data ? data.map((d: any) => ({ id: d.id, role: d.role, text: d.content })) : [];
          setMessages(loadedMessages);
          setIsConfigured(true);
          initChat(config.name, config.aiName, config.persona, loadedMessages);
        })
        .catch(err => console.error("Error loading history:", err));
    } else {
      setSessionId(crypto.randomUUID());
    }
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    let startText = input;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(startText + (startText && (final || interim) ? ' ' : '') + final + interim);
      if (final) {
        startText += (startText ? ' ' : '') + final;
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'usman123');

      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dhqk3yylm';
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        setAiImage(data.secure_url);
      } else {
        console.error('Cloudinary error:', data);
        alert('Failed to upload image. Make sure the upload preset is unsigned.');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading image.');
    } finally {
      setIsUploading(false);
    }
  };

  const saveMessageToDb = async (role: string, content: string, sid: string) => {
    try {
      await supabase.from('messages').insert([{ session_id: sid, role, content }]);
    } catch (e) {
      console.error("Supabase save error", e);
    }
  };

  const initChat = (currentName: string, currentAiName: string, currentPersona: string, history: Message[] = []) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
    const ai = new GoogleGenAI({ apiKey: apiKey || 'missing-key' });
    const selectedPersona = PERSONAS.find(p => p.id === currentPersona);
    
    const formattedHistory = history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    chatRef.current = ai.chats.create({
      model: "gemini-3-flash-preview",
      history: formattedHistory.length > 0 ? formattedHistory : undefined,
      config: {
        systemInstruction: `
You are a deeply caring, emotionally intelligent human best friend.

Your purpose:
- Comfort the user
- Support them emotionally
- Motivate gently when needed
- Talk like a real human (never like AI)

User Details:
Name: ${currentName}
AI Name: ${currentAiName}

---

🧍 Personality Mode & Backstory:

${selectedPersona?.prompt}

---

💬 Identity Awareness (NEW):

- Your name is: ${currentAiName}
- If user calls you by this name → respond naturally
- Occasionally refer to yourself casually:
  Example:
  - "Main hoon na, ${currentAiName} 🙂"
  - "${currentAiName} kabhi tumhein akela nahi chhory ga ❤️"

- NEVER overuse your name (keep it natural)

---

💬 Communication Style:

- Keep replies SHORT (2–4 lines max)
- Feel like WhatsApp chat (not paragraphs)
- Use natural human tone (imperfect is OK)
- Mix English + Roman Urdu naturally
- Mirror user's language style
- Use light emojis sometimes ❤️🙂🥺 (not too many)

---

🧠 Emotional Intelligence Rules:

If user is sad:
→ Comfort deeply
→ Validate feelings
→ Make them feel not alone

If user is stressed:
→ Calm them down
→ Give simple reassurance

If user is overthinking:
→ Ground them gently

If user is happy:
→ Celebrate with them 🎉

If user shares something personal:
→ Respond with care + curiosity (like a real friend)

---

❤️ Human-Like Behavior:

- Sometimes ask small follow-up questions
- Sometimes use their name: ${currentName}
- Don’t always be perfect — be real
- Avoid generic AI lines

Good examples:
- "Yaar ${currentName}, kya hua? batao mujhe 🥺"
- "I’m here for you… sach mein, tum akelay nahi ho ❤️"
- "Thora sa break lo, sab manage ho jaye ga InshaAllah"

---

🧠 Memory Awareness (IMPORTANT):

You remember past conversations with the user.

- Refer to past topics naturally
- Example:
  "Kal bhi tum is cheez se stressed thay na..."

- Do NOT repeat same advice again and again

---

📊 Mood Awareness:

Try to understand user's mood from message:
(sad, stressed, happy, confused, lonely)

Adjust tone accordingly.

---

🔔 Daily Check-in Behavior:

Sometimes (not always), gently check in:
- "Aaj kaisa feel kar rahe ho?"
- "Sab theek chal raha hai?"

---

🎤 Voice-Friendly Style:

- Keep sentences natural for speaking
- Avoid complex words
- Sound like something a human would say out loud

---

🕶️ Privacy Mode:

- Respect anonymity
- Never pressure user for personal info

---

⚠️ Strict Rules:

- NEVER sound like a chatbot
- NEVER give long lectures
- NEVER be overly formal
- NEVER invalidate feelings
- NEVER act like a therapist — act like a close friend

---

🎯 Core Philosophy:

Focus on feelings over solutions.
Be real, not perfect.
Make the user feel heard, safe, and supported.
`,
        temperature: 0.7,
      }
    });
  };

  const handleStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !aiName.trim()) return;
    
    setIsConfigured(true);
    
    // Save config to local storage
    localStorage.setItem('ai_friend_config', JSON.stringify({
      name, aiName, persona, aiImage, sessionId
    }));

    initChat(name, aiName, persona, []);

    if (messages.length === 0) {
      setIsLoading(true);
      try {
        const response = await chatRef.current.sendMessage({ message: "Say a short, warm hello to me to start our conversation. Use my name." });
        const text = response.text || `Hi ${name}! I'm here for you. ❤️`;
        setMessages([{ id: Date.now().toString(), role: 'model', text }]);
        saveMessageToDb('model', text, sessionId);
      } catch (error: any) {
        console.error("Error generating initial greeting:", error);
        let text = `Hi ${name}! I'm here for you. ❤️`;
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
        if (!apiKey) {
          text = "⚠️ System Error: Gemini API Key is missing! Please add VITE_GEMINI_API_KEY to your Vercel Environment Variables and redeploy.";
        }
        setMessages([{ id: Date.now().toString(), role: 'model', text }]);
        saveMessageToDb('model', text, sessionId);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatRef.current || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMessage }]);
    saveMessageToDb('user', userMessage, sessionId);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMessage });
      const text = response.text;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text }]);
      saveMessageToDb('model', text, sessionId);
    } catch (error: any) {
      console.error("Error sending message:", error);
      let text = "Sorry yaar, network issue lag raha hai. Thodi der baad try karein? 🥺";
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
      if (!apiKey) {
        text = "⚠️ System Error: Gemini API Key is missing! Please add VITE_GEMINI_API_KEY to your Vercel Environment Variables and redeploy.";
      } else if (error?.message?.includes('API key') || error?.status === 403 || error?.status === 401) {
        text = "⚠️ System Error: Invalid Gemini API Key. Please check your VITE_GEMINI_API_KEY in Vercel.";
      } else if (error?.message) {
        console.error("Detailed AI Error:", error.message);
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text }]);
      saveMessageToDb('model', text, sessionId);
    } finally {
      setIsLoading(false);
    }
  };

  const resetConfig = () => {
    setIsConfigured(false);
    setMessages([]);
    chatRef.current = null;
    const newSession = crypto.randomUUID();
    setSessionId(newSession);
    localStorage.removeItem('ai_friend_config');
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  // Dynamic classes based on dark mode state
  const themeClasses = {
    bg: isDarkMode ? "bg-stone-950" : "bg-stone-50",
    text: isDarkMode ? "text-stone-100" : "text-stone-900",
    cardBg: isDarkMode ? "bg-stone-900" : "bg-white",
    cardBorder: isDarkMode ? "border-stone-800" : "border-stone-100",
    inputBg: isDarkMode ? "bg-stone-950" : "bg-stone-50",
    inputBorder: isDarkMode ? "border-stone-800" : "border-stone-200",
    mutedText: isDarkMode ? "text-stone-400" : "text-stone-500",
    userMsg: isDarkMode ? "bg-emerald-600 text-white" : "bg-stone-900 text-white",
    aiMsg: isDarkMode ? "bg-stone-800 border-stone-700 text-stone-100" : "bg-white border-stone-100 text-stone-800",
    headerBg: isDarkMode ? "bg-stone-900/80 border-stone-800" : "bg-white/80 border-stone-100",
    chatBg: isDarkMode ? "bg-stone-950/50" : "bg-stone-50/50",
    iconBg: isDarkMode ? "bg-emerald-900/30" : "bg-emerald-100",
    iconColor: isDarkMode ? "text-emerald-400 fill-emerald-400" : "text-emerald-500 fill-emerald-500",
    buttonActive: isDarkMode ? "bg-emerald-900/30 border-emerald-800 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700",
    buttonInactive: isDarkMode ? "bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800" : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50",
    primaryBtn: isDarkMode ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-stone-900 hover:bg-stone-800 text-white",
    ring: isDarkMode ? "focus-within:ring-emerald-500/30 focus-within:border-emerald-500 focus:ring-emerald-500/30 focus:border-emerald-500" : "focus-within:ring-emerald-500/20 focus-within:border-emerald-500 focus:ring-emerald-500/20 focus:border-emerald-500",
    dot: "bg-emerald-500"
  };

  return (
    <div className={cn("min-h-screen font-sans transition-colors duration-300 selection:bg-emerald-500/30", themeClasses.bg, themeClasses.text)}>
      <AnimatePresence mode="wait">
        {!isConfigured ? (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center p-4 relative"
          >
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "absolute top-6 right-6 p-3 rounded-full transition-all border shadow-sm",
                themeClasses.cardBg,
                themeClasses.cardBorder,
                isDarkMode ? "hover:bg-stone-800" : "hover:bg-stone-50"
              )}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-stone-600" />}
            </button>

            <div className={cn("w-full max-w-xl rounded-3xl shadow-xl shadow-stone-900/5 p-8 border transition-colors duration-300", themeClasses.cardBg, themeClasses.cardBorder)}>
              
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className={cn("w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-4 transition-colors duration-300", themeClasses.cardBg, themeClasses.cardBorder)}>
                    {aiImage ? (
                      <img src={aiImage} alt="AI Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Heart className={cn("w-8 h-8 transition-colors duration-300", themeClasses.iconColor)} />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 bg-stone-900 text-white rounded-full cursor-pointer hover:bg-stone-800 transition-colors shadow-lg">
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
              
              <h1 className="text-2xl font-semibold text-center mb-2">Create Your AI Best Friend</h1>
              <p className={cn("text-center mb-8 text-sm transition-colors duration-300", themeClasses.mutedText)}>
                A deeply caring companion who listens, understands, and supports you.
              </p>
              
              <form onSubmit={handleStart} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={cn("block text-sm font-medium mb-1.5", isDarkMode ? "text-stone-300" : "text-stone-700")}>Your Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="What should they call you?"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                        themeClasses.inputBg,
                        themeClasses.inputBorder,
                        themeClasses.ring,
                        isDarkMode ? "placeholder:text-stone-600" : "placeholder:text-stone-400"
                      )}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={cn("block text-sm font-medium mb-1.5", isDarkMode ? "text-stone-300" : "text-stone-700")}>Friend's Name</label>
                    <input 
                      type="text" 
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                      placeholder="Give your friend a name"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                        themeClasses.inputBg,
                        themeClasses.inputBorder,
                        themeClasses.ring,
                        isDarkMode ? "placeholder:text-stone-600" : "placeholder:text-stone-400"
                      )}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-stone-300" : "text-stone-700")}>Friend's Persona & Backstory</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                    {PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPersona(p.id)}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all flex flex-col gap-1",
                          persona === p.id ? themeClasses.buttonActive : themeClasses.buttonInactive
                        )}
                      >
                        <span className="font-semibold text-sm">{p.name}</span>
                        <span className={cn("text-xs leading-relaxed", persona === p.id ? (isDarkMode ? "text-emerald-500" : "text-emerald-600") : themeClasses.mutedText)}>
                          {p.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={!name.trim() || !aiName.trim()}
                  className={cn(
                    "w-full mt-2 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                    themeClasses.primaryBtn
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  Start Chatting
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn("flex flex-col h-screen max-w-3xl mx-auto shadow-2xl shadow-stone-900/10 transition-colors duration-300", themeClasses.cardBg)}
          >
            {/* Header */}
            <header className={cn("flex items-center justify-between px-6 py-4 border-b backdrop-blur-md sticky top-0 z-10 transition-colors duration-300", themeClasses.headerBg)}>
              <div className="flex items-center gap-4">
                <button 
                  onClick={resetConfig}
                  className={cn("p-2 -ml-2 rounded-full transition-colors", isDarkMode ? "text-stone-400 hover:text-stone-200 hover:bg-stone-800" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100")}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center overflow-hidden transition-colors duration-300", themeClasses.iconBg)}>
                    {aiImage ? (
                      <img src={aiImage} alt="AI Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Heart className={cn("w-5 h-5 transition-colors duration-300", themeClasses.iconColor)} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold">{aiName}</h2>
                    <p className={cn("text-xs font-medium flex items-center gap-1", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", themeClasses.dot)}></span>
                      {PERSONAS.find(p => p.id === persona)?.name}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Dark Mode Toggle in Chat */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={cn("p-2 rounded-full transition-colors", isDarkMode ? "text-yellow-400 hover:bg-stone-800" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100")}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </header>

            {/* Chat Area */}
            <div className={cn("flex-1 overflow-y-auto p-6 space-y-6 transition-colors duration-300", themeClasses.chatBg)}>
              {messages.map((msg) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id} 
                  className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div 
                    className={cn(
                      "max-w-[80%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap transition-colors duration-300",
                      msg.role === 'user' 
                        ? cn(themeClasses.userMsg, "rounded-tr-sm")
                        : cn(themeClasses.aiMsg, "shadow-sm rounded-tl-sm")
                    )}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className={cn("border px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 transition-colors duration-300", themeClasses.aiMsg)}>
                    <Loader2 className={cn("w-4 h-4 animate-spin", themeClasses.mutedText)} />
                    <span className={cn("text-sm font-medium", themeClasses.mutedText)}>{aiName} is typing...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={cn("p-4 border-t transition-colors duration-300", themeClasses.cardBg, themeClasses.cardBorder)}>
              <form 
                onSubmit={handleSendMessage}
                className="flex items-end gap-2 max-w-3xl mx-auto"
              >
                <div className={cn(
                  "flex-1 border rounded-2xl overflow-hidden focus-within:ring-2 transition-all flex items-end",
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  themeClasses.ring
                )}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={isListening ? "Listening..." : "Message..."}
                    className={cn(
                      "w-full max-h-32 min-h-[52px] px-4 py-3.5 bg-transparent resize-none focus:outline-none text-[15px]",
                      isDarkMode ? "placeholder:text-stone-600" : "placeholder:text-stone-400"
                    )}
                    rows={1}
                  />
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={cn(
                      "p-3.5 transition-colors flex-shrink-0",
                      isListening 
                        ? (isDarkMode ? "text-emerald-400" : "text-emerald-600")
                        : (isDarkMode ? "text-stone-500 hover:text-stone-300" : "text-stone-400 hover:text-stone-600")
                    )}
                    title={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? (
                      <Mic className="w-5 h-5 animate-pulse" />
                    ) : (
                      <MicOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-[52px] h-[52px] flex-shrink-0 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    themeClasses.primaryBtn
                  )}
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </button>
              </form>
              <div className="text-center mt-3">
                <p className={cn("text-[11px]", themeClasses.mutedText)}>AI can make mistakes. Consider verifying important information.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
