// File: components/NotificationBell.tsx
// Este componente renderiza o ícone de sino de notificações no cabeçalho.

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const NotificationBell: React.FC = () => {
    // Acessa os dados do usuário logado e das notificações.
    const { user } = useAuth();
    const { notifications, markNotificationAsRead } = useData();
    // Estado para controlar se o menu dropdown de notificações está aberto.
    const [isOpen, setIsOpen] = useState(false);
    // `useRef` é usado para obter uma referência ao elemento do dropdown no DOM.
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filtra as notificações para exibir apenas as do usuário logado.
    const userNotifications = user ? notifications.filter(n => n.userId === user.id) : [];
    // Conta quantas notificações não foram lidas para exibir no ícone.
    const unreadCount = userNotifications.filter(n => !n.read).length;

    // `useEffect` para adicionar um event listener que fecha o dropdown se o usuário clicar fora dele.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        // Função de limpeza: remove o event listener quando o componente é desmontado para evitar memory leaks.
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Função para abrir/fechar o dropdown.
    const handleToggle = () => {
        setIsOpen(!isOpen);
        // Se o dropdown está sendo aberto, marca todas as notificações não lidas como lidas.
        if(!isOpen) {
            userNotifications.filter(n => !n.read).forEach(n => markNotificationAsRead(n.id));
        }
    }

    // JSX para renderizar o sino e o menu dropdown.
    return (
        <div className="relative" ref={dropdownRef}>
            {/* Botão do sino */}
            <button onClick={handleToggle} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring relative">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
                {/* Badge com a contagem de notificações não lidas, renderizado condicionalmente. */}
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Menu Dropdown de notificações, renderizado condicionalmente. */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden z-10">
                    <div className="py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-200 border-b dark:border-gray-700">Notificações</div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                        {userNotifications.length > 0 ? (
                            // Mapeia e exibe cada notificação.
                            userNotifications.map(n => (
                                <div key={n.id} className={`p-3 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{n.message}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                            // Mensagem exibida se não houver notificações.
                            <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">Nenhuma notificação</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
