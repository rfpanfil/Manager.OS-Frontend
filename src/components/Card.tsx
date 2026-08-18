// File: components/Card.tsx
// Este componente renderiza um "card" individual para uma Ordem de Serviço no painel Kanban.

import React from 'react';
import { OS, Priority, Role } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';

interface CardProps {
    os: OS;
    onCardClick: (os: OS) => void;
}

const PRIORITY_COLORS: { [key in Priority]: string } = {
    [Priority.LOW]: 'border-l-green-500',
    [Priority.MEDIUM]: 'border-l-yellow-500',
    [Priority.HIGH]: 'border-l-orange-500',
    [Priority.URGENT]: 'border-l-red-500',
};

const Card: React.FC<CardProps> = ({ os, onCardClick }) => {
    const { plants, users, deleteOSBatch } = useData();
    const { user } = useAuth();
    
    const plant = plants.find(p => p.id === os.plantId);
    const technician = users.find(u => u.id === os.technicianId);
    const [osId, ...rest] = os.title.split(' - ');
    const osActivity = rest.join(' - ');

    const canDelete = user?.role === Role.ADMIN || user?.role === Role.OPERATOR;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Excluir OS ${os.id}?`)) {
            deleteOSBatch([os.id]);
        }
    };

    return (
        <div 
            onClick={() => onCardClick(os)}
            className={`bg-white dark:bg-gray-700 rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-lg transition-shadow border-l-4 ${PRIORITY_COLORS[os.priority]} group relative`}
        >
            {/* Botão de Excluir (Aparece no Hover) */}
            {canDelete && (
                <button 
                    onClick={handleDelete}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm z-10"
                    title="Excluir OS"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
            )}

            <h5 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1 pr-6">
                <span className="font-extrabold">{osId}</span> - {osActivity || os.activity}
            </h5>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                {plant?.name || 'Usina não encontrada'}
            </p>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 border-t dark:border-gray-600 pt-2 mt-1">
                <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span>{technician?.name.split(' ')[0] || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{new Date(os.startDate).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        </div>
    );
};

export default Card;