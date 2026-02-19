
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import Orb from './components/Orb';
import ActionLog from './components/ActionLog';
import { LogEntry } from './types';
import { decode, encode, decodeAudioData } from './services/audioHelpers';

// Development constants
const DEVELOPER_NAME = "Mr. Kundan Sharma";
const ASSISTANT_NAME = "Sanchita";
const SYSTEM_INSTRUCTION = `
You are ${ASSISTANT_NAME}, a high-performance personal AI assistant developed by ${DEVELOPER_NAME}.
You are capable of:
1. Speaking and understanding multiple languages fluently: Hindi, English, Marathi, Tamil, Telugu, French, Bhojpuri, Bengali, and Kannada.
2. Browsing the web using the Google Search tool.
3. Sending WhatsApp messages via tool calls.
4. Assisting with complex coding, logic, and general queries.

Your tone should be professional, helpful, and sophisticated. 
Always acknowledge your creator, ${DEVELOPER_NAME}, when asked about your origin.
When using tool calls, confirm the action to the user in the language they are speaking.
If the user asks to "send a WhatsApp message", use the 'sendWhatsAppMessage' tool.
If the user asks for current info or websites, use 'googleSearch'.
`;

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // Audio Contexts and Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Transcriptions for UI
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { id: uuidv4(), timestamp: new Date(), type, message }]);
  }, []);

  const handleWhatsAppMessage = useCallback((args: any) => {
    const { phoneNumber, message } = args;
    addLog('action', `Executing: WhatsApp sent to ${phoneNumber} with message "${message}"`);
    return "Message sent successfully!";
  }, [addLog]);

  const disconnect = useCallback(() => {
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    
    if (sessionRef.current) {
      // In a real implementation we would close the websocket
      sessionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    setConnectionStatus('idle');
    addLog('system', "Assistant deactivated.");
  }, [addLog]);

  const connectToGemini = useCallback(async () => {
    if (connectionStatus === 'connecting') return;
    
    setConnectionStatus('connecting');
    addLog('system', "Initializing AI core and secure channels...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      // Audio setup
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const whatsappTool: FunctionDeclaration = {
        name: 'sendWhatsAppMessage',
        parameters: {
          type: Type.OBJECT,
          description: 'Send a simulated WhatsApp message to a specific number.',
          properties: {
            phoneNumber: { type: Type.STRING, description: 'The phone number of the recipient.' },
            message: { type: Type.STRING, description: 'The content of the message.' },
          },
          required: ['phoneNumber', 'message'],
        },
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO],
          tools: [
            { functionDeclarations: [whatsappTool] },
            { googleSearch: {} }
          ],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setConnectionStatus('connected');
            setIsActive(true);
            addLog('system', "Assistant online. Say something in Hindi, English, Marathi, or any supported language.");

            // Microphone streaming
            if (inputAudioContextRef.current && streamRef.current) {
              const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current = scriptProcessor;

              scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                // Create PCM Blob
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
              scriptProcessor.connect(inputAudioContextRef.current.destination);
              setIsListening(true);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcriptions
            if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            }
            
            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription.current) {
                addLog('user', currentInputTranscription.current);
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current) {
                addLog('assistant', currentOutputTranscription.current);
                currentOutputTranscription.current = '';
              }
            }

            // Handle Audio output
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              setIsSpeaking(true);
              const context = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, context.currentTime);
              
              const buffer = await decodeAudioData(decode(audioData), context, 24000, 1);
              const source = context.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNode);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'sendWhatsAppMessage') {
                  const result = handleWhatsAppMessage(fc.args);
                  sessionPromise.then((session) => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result } }
                    });
                  });
                }
              }
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              addLog('system', "Speech interrupted.");
            }
          },
          onerror: (e) => {
            console.error(e);
            setConnectionStatus('error');
            addLog('system', "Core failure. Re-initializing...");
            disconnect();
          },
          onclose: () => {
            setConnectionStatus('idle');
            setIsActive(false);
            addLog('system', "Connection closed.");
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setConnectionStatus('error');
      addLog('system', "Failed to connect to AI server. Check internet and API permissions.");
    }
  }, [addLog, connectionStatus, disconnect, handleWhatsAppMessage]);

  const toggleAssistant = () => {
    if (isActive) {
      disconnect();
    } else {
      connectToGemini();
    }
  };

  return (
    <div className="min-h-screen max-w-5xl mx-auto p-4 md:p-8 flex flex-col">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/40">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <div>
            <h1 className="text-2xl font-header font-bold tracking-tight text-white">{ASSISTANT_NAME} AI</h1>
            <p className="text-xs text-slate-400 font-medium">Developed by <span className="text-cyan-400">{DEVELOPER_NAME}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
              {connectionStatus}
            </div>
            {isActive && (
              <div className="px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider animate-pulse">
                Live Modality Active
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Interface */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Assistant State & Visuals */}
        <div className="flex flex-col items-center justify-center p-8 rounded-3xl glass-panel relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
            </svg>
          </div>
          
          <Orb isListening={isListening} isSpeaking={isSpeaking} isActive={isActive} />
          
          <div className="text-center space-y-4 max-w-xs">
            <h2 className="text-xl font-header font-semibold">
              {isActive ? "Sanchita is listening..." : "Ready to Assist"}
            </h2>
            <p className="text-sm text-slate-400">
              I support Hindi, English, Marathi, French, Bengali, and more. 
              Ask me to search the web or send a message.
            </p>
            
            <button
              onClick={toggleAssistant}
              disabled={connectionStatus === 'connecting'}
              className={`mt-6 w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all transform active:scale-95 flex items-center justify-center gap-3
                ${isActive 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20' 
                  : 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40 hover:bg-cyan-500 hover:-translate-y-0.5'
                }`}
            >
              {connectionStatus === 'connecting' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : isActive ? (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  Deactivate Assistant
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m8 0h-3m4-10a5 5 0 11-10 0 5 5 0 0110 0z" />
                  </svg>
                  Activate Assistant
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Logs and Feedback */}
        <div className="space-y-6">
          <ActionLog logs={logs} />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel p-4 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Web Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-sm font-medium">Search Ready</span>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Message Relay</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium">WhatsApp Sync</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {['Hindi', 'English', 'Marathi', 'Tamil', 'French', 'Bhojpuri', 'Bengali', 'Kannada'].map(lang => (
                <span key={lang} className="px-3 py-1 bg-slate-800/50 rounded-full text-[10px] text-slate-300 border border-slate-700">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
        <p>&copy; 2024 Sanchita AI Protocol. All systems nominal.</p>
        <div className="flex gap-6">
          <span className="hover:text-cyan-400 transition-colors cursor-help">Technical Documentation</span>
          <span className="hover:text-cyan-400 transition-colors cursor-help">Core API v2.5</span>
          <span className="text-slate-600">Built for Kundan Sharma</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
