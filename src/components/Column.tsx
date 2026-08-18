// File: components/Column.tsx
import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { OS, OSStatus } from '../types';
import Card from './Card';
import { STATUS_COLORS } from '../constants';

interface ColumnProps {
    status: OSStatus;
    title: string;
    items: OS[];
    onCardClick: (os: OS) => void;
    color: string;
    // ✅ Propriedade para o botão de download
    onOpenDownloadFilter?: (status: OSStatus) => void;
    isFutureColumn?: boolean;
}

const ITEMS_PER_PAGE = 10;

const Column: React.FC<ColumnProps> = ({ 
    status, title, items, onCardClick, color, 
    onOpenDownloadFilter, isFutureColumn 
}) => {
    
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    
    const headerColor = isFutureColumn ? 'bg-indigo-500 text-white' : (color || STATUS_COLORS[status]);
    const droppableId = isFutureColumn ? 'FUTURE' : status;

    const visibleOS = items.slice(0, visibleCount);
    const hasMore = items.length > visibleCount;

    return (
        <div className={`flex flex-col w-80 rounded-lg shadow-md flex-shrink-0 max-h-full bg-gray-200 dark:bg-gray-800`}>
            <div className={`flex items-center justify-between p-3 rounded-t-lg ${headerColor}`}>
                 <h4 className="font-bold text-white flex items-center">
                    {isFutureColumn && <span className="mr-2">⏳</span>}
                    {title}
                 </h4>
                 <div className="flex items-center space-x-2">
                    {/* ✅ BOTÃO DOWNLOAD RESTAURADO */}
                    {!isFutureColumn && onOpenDownloadFilter && (
                        <button 
                            onClick={() => onOpenDownloadFilter(status)} 
                            title="Baixar relatórios desta coluna" 
                            className="text-white hover:bg-white/20 p-1 rounded transition-colors"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                             </svg>
                        </button>
                    )}
                    <span className="px-2 py-1 text-xs font-semibold text-white bg-black bg-opacity-20 rounded-full">
                        {items.length}
                    </span>
                 </div>
            </div>
           
            <Droppable droppableId={droppableId}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-2 overflow-y-auto transition-colors scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent ${snapshot.isDraggingOver ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                        style={{ minHeight: '100px' }} 
                    >
                        {visibleOS.map((os, index) => (
                            <Draggable key={os.id} draggableId={os.id} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`mb-3 ${snapshot.isDragging ? 'opacity-80 shadow-2xl' : ''}`}
                                    >
                                        <Card os={os} onCardClick={onCardClick} />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                        {hasMore && (
                            <button onClick={() => setVisibleCount(p => p + ITEMS_PER_PAGE)} className="w-full py-2 text-xs font-bold text-gray-500 bg-gray-300 rounded mt-2">
                                Carregar mais...
                            </button>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

export default Column;