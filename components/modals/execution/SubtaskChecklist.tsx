import React from 'react';
import { Camera, CheckSquare, Square, Trash2, UploadCloud } from 'lucide-react';
import { SubtaskItem } from '../../../types';
import { API_BASE } from '../../utils/config';

interface SubtaskChecklistProps {
  subtasks: SubtaskItem[];
  isRunning: boolean;
  isUploading: boolean;
  onCheck: (index: number) => void;
  onCommentChange: (index: number, text: string) => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  onTakePhoto: (index: number) => void;
  onDeletePhoto: (attId: string) => void;
  getImagesForItem: (index: number) => any[];
}

export const SubtaskChecklist: React.FC<SubtaskChecklistProps> = ({
  subtasks,
  isRunning,
  isUploading,
  onCheck,
  onCommentChange,
  onPhotoUpload,
  onTakePhoto,
  onDeletePhoto,
  getImagesForItem,
}) => {
  const resolveAssetUrl = (u?: string) => {
    if (!u) return '';
    if (u.startsWith('blob:')) return u;
    if (u.startsWith('data:')) return u;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `${API_BASE}${u.startsWith('/') ? u : `/${u}`}`;
  };

  const hasIT = (t: string) => {
    const up = (t || '').toUpperCase();
    return up.includes('IT_') || up.includes('INSTRUÇÃO');
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
      <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex gap-2 items-center">
        <CheckSquare size={16} />
        Checklist
      </h4>

      {subtasks.map((item, i) => {
        // Determinar estilo base do item
        let bgClass = item.done
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600';

        if (item.isApproved) {
          bgClass = 'bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600';
        } else if (item.isRejected) {
          bgClass = 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600';
        }

        return (
          <div
            key={i}
            className={`p-3 rounded border mb-3 transition-colors ${bgClass}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div 
                className={`flex gap-2 flex-1 ${item.isApproved ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`} 
                onClick={() => !item.isApproved && onCheck(i)}
              >
                <div className={item.done ? 'text-green-600' : item.isRejected ? 'text-red-500' : 'text-gray-400'}>
                  {item.done ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>

                <span
                  className={`text-sm ${
                    item.done ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'
                  } ${item.isRejected ? 'text-red-800 dark:text-red-200 font-medium' : ''}`}
                >
                  <span className="text-blue-500 font-bold mr-2">{i + 1}</span>
                  {item.text}
                  {hasIT(item.text) && (
                    <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1 rounded">
                      IT
                    </span>
                  )}
                </span>
              </div>

              <div className="flex gap-1">
                <label
                  className={`p-1 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${
                    isUploading || item.isApproved ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  title={item.isApproved ? "Item aprovado" : "Selecionar da galeria"}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={(e) => onPhotoUpload(e, i)}
                    disabled={isUploading || item.isApproved}
                  />
                  <UploadCloud className="text-gray-400 w-5 h-5" />
                </label>

                <button
                  type="button"
                  onClick={() => onTakePhoto(i)}
                  disabled={isUploading || item.isApproved}
                  className={`p-1 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${item.isApproved ? 'opacity-50 pointer-events-none' : ''}`}
                  title={item.isApproved ? "Item aprovado" : "Tirar foto agora"}
                >
                  <Camera className="text-gray-400 w-5 h-5" />
                </button>
              </div>
            </div>

            {item.isRejected && item.rejectionReason && (
              <div className="mb-3 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-xs p-2 rounded border border-red-200 dark:border-red-800 flex items-start gap-2">
                <span className="font-bold">Motivo da reprovação:</span> {item.rejectionReason}
              </div>
            )}

            <textarea
              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm text-gray-800 dark:text-gray-200 outline-none resize-y min-h-[60px] disabled:opacity-70 disabled:bg-gray-50 dark:disabled:bg-gray-800"
              placeholder="Observação..."
              value={item.comment || ''}
              onChange={(e) => onCommentChange(i, e.target.value)}
              disabled={item.isApproved}
            />

          {getImagesForItem(i).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {getImagesForItem(i).map((img: any) => (
                <div key={img.id} className="relative w-16 h-16 group">
                  <img
                    src={resolveAssetUrl(img.url)}
                    className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600"
                  />
                  <button
                    onClick={() => onDeletePhoto(img.id)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow z-10"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
};
