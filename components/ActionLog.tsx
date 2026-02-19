
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface ActionLogProps {
  logs: LogEntry[];
}

const ActionLog: React.FC<ActionLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel rounded-2xl p-6 h-[400px] flex flex-col overflow-hidden">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center">
        <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2 animate-pulse" />
        Activity Monitor
      </h3>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">
            Waiting for connection...
          </div>
        )}
        {logs.map((log) => (
          <div 
            key={log.id} 
            className={`p-3 rounded-xl border ${
              log.type === 'assistant' ? 'bg-blue-500/10 border-blue-500/20' :
              log.type === 'user' ? 'bg-emerald-500/10 border-emerald-500/20' :
              log.type === 'action' ? 'bg-purple-500/10 border-purple-500/20 text-purple-200' :
              'bg-slate-800/50 border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] font-bold uppercase ${
                log.type === 'assistant' ? 'text-blue-400' :
                log.type === 'user' ? 'text-emerald-400' :
                log.type === 'action' ? 'text-purple-400' :
                'text-slate-500'
              }`}>
                {log.type}
              </span>
              <span className="text-[10px] text-slate-600">
                {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{log.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionLog;
