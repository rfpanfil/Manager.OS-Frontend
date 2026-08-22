import React from 'react';
import { Play } from 'lucide-react';

interface ExecutionTimerProps {
  isRunning: boolean;
  elapsedSession: number;
  totalExecutionTimeSeconds: number;
  onStart: () => void;
}

export const ExecutionTimer: React.FC<ExecutionTimerProps> = ({
  isRunning,
  elapsedSession,
  totalExecutionTimeSeconds,
  onStart,
}) => {
  const formatTime = (totalSeconds: number) => {
    const t = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`${
        isRunning ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
      } border rounded-lg p-2 mb-2 flex justify-between items-center shadow-inner`}
    >
      {!isRunning ? (
        <button
          onClick={onStart}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Play size={20} />
          INICIAR / CONTINUAR EXECUÇÃO
        </button>
      ) : (
        <div className="flex justify-between w-full text-white px-2">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Sessão</div>
            <div className="text-2xl font-mono font-bold">{formatTime(elapsedSession)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 uppercase">Total</div>
            <div className="text-lg font-mono text-gray-300">
              {formatTime(totalExecutionTimeSeconds + elapsedSession)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
