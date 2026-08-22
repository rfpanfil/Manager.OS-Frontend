import React, { useRef } from 'react';
import { Camera, Trash2, UploadCloud } from 'lucide-react';
import { API_BASE } from '../../utils/config';

interface PhotoUploaderProps {
  generalImages: any[];
  isOnline: boolean;
  isUploading: boolean;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTakePhoto: () => void;
  onDeletePhoto: (attId: string) => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  generalImages,
  isOnline,
  isUploading,
  onPhotoUpload,
  onTakePhoto,
  onDeletePhoto,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolveAssetUrl = (u?: string) => {
    if (!u) return '';
    if (u.startsWith('blob:')) return u;
    if (u.startsWith('data:')) return u;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `${API_BASE}${u.startsWith('/') ? u : `/${u}`}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
      <h5 className="text-sm font-bold text-gray-500 uppercase mb-3 flex gap-2 items-center">
        <Camera size={16} />
        Fotos Gerais
        {!isOnline && (
          <span className="text-xs text-amber-600 font-medium">(Offline: sync pendente)</span>
        )}
      </h5>

      <div className="flex flex-wrap gap-2">
        {generalImages.map((img: any) => (
          <div key={img.id} className="relative w-20 h-20 group">
            <img
              src={resolveAssetUrl(img.url)}
              className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600 shadow-sm"
            />
            <button
              onClick={() => onDeletePhoto(img.id)}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 shadow"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {/* Galeria */}
        <label
          className={`w-20 h-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-500 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${
            isUploading ? 'opacity-50 pointer-events-none' : ''
          }`}
          title="Selecionar da galeria"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={onPhotoUpload}
            disabled={isUploading}
          />
          <UploadCloud className="text-gray-400 dark:text-gray-300" />
        </label>

        {/* Câmera */}
        <button
          type="button"
          onClick={onTakePhoto}
          disabled={isUploading}
          className="w-20 h-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-500 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Tirar foto agora"
        >
          <Camera className="text-gray-400 dark:text-gray-300" />
        </button>
      </div>
    </div>
  );
};
