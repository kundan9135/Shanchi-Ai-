
import React from 'react';

interface OrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  isActive: boolean;
}

const Orb: React.FC<OrbProps> = ({ isListening, isSpeaking, isActive }) => {
  return (
    <div className="relative flex items-center justify-center w-64 h-64 mx-auto my-8">
      {/* Outer rings */}
      <div className={`absolute inset-0 rounded-full border-2 border-cyan-500/20 transition-all duration-700 ${isActive ? 'scale-110' : 'scale-90 opacity-0'}`} />
      <div className={`absolute inset-4 rounded-full border border-blue-400/30 animate-pulse transition-all duration-700 ${isActive ? 'scale-105' : 'scale-90 opacity-0'}`} />
      
      {/* Core Orb */}
      <div 
        className={`relative z-10 w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl
          ${!isActive ? 'bg-slate-800 grayscale scale-90' : 
            isSpeaking ? 'bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-blue-500/50 scale-110' :
            isListening ? 'bg-gradient-to-tr from-emerald-400 to-cyan-500 shadow-cyan-400/50 scale-105 animate-pulse' :
            'bg-gradient-to-tr from-blue-600 to-indigo-700 shadow-indigo-500/30'
          }`}
      >
        {/* Core Detail */}
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-cyan-300 shadow-[0_0_10px_#67e8f9]' : 'bg-slate-600'}`} />
        </div>

        {/* Dynamic Visualizer (Speaking) */}
        {isActive && isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center space-x-1 opacity-60">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="w-1 bg-white rounded-full animate-bounce" 
                style={{ height: '40%', animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Glow Effect */}
      {isActive && (
        <div className={`absolute inset-0 rounded-full blur-[60px] opacity-30 pointer-events-none transition-colors duration-500 ${isSpeaking ? 'bg-blue-500' : isListening ? 'bg-emerald-500' : 'bg-cyan-500'}`} />
      )}
    </div>
  );
};

export default Orb;
