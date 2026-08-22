// File: components/modals/Modal.tsx
// Este é um componente de Modal genérico e reutilizável que serve como base para todos os outros modais da aplicação.

import React, { ReactNode, useEffect } from 'react'; // ADICIONADO: useEffect para tratar tecla ESC

// Define as propriedades que o componente Modal espera receber.
interface ModalProps {
  isOpen: boolean; // Controla se o modal está visível ou não.
  onClose: () => void; // Função a ser chamada para fechar o modal.
  title: string; // O título exibido no cabeçalho do modal.
  children: ReactNode; // O conteúdo principal do modal.
  footer?: ReactNode; // Conteúdo opcional para o rodapé (geralmente botões de ação).
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  // Se `isOpen` for falso, o componente não renderiza nada.
  if (!isOpen) return null;

  // ADICIONADO: Fechar com ESC, mas nunca quando o foco está em um campo editável
  // Motivo: evita que o modal “roube” o foco dos inputs durante a digitação.
// ADICIONADO: Fechar com ESC apenas quando não estiver digitando em campos editáveis
useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      const editable = el?.getAttribute?.("contenteditable") === "true";
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable;
      if (e.key === "Escape" && !isEditing) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

// ADICIONADO: util para travar propagação de clique no overlay
const stop = (e: React.MouseEvent) => e.stopPropagation();


  // A estrutura do modal consiste em um overlay (fundo escuro) e o painel do modal em si.
  return (
    <>
      {/* ✅ OVERLAY - apenas overlay com opacidade */}
      <div
        className={`fixed inset-0 z-50 bg-black bg-opacity-30 pointer-events-none transition-opacity ${
          isOpen ? 'opacity-30' : 'opacity-0'
        }`}
        onMouseDown={stop} 
        onMouseUp={stop} 
        onClick={stop}
      />

      {/* ✅ MODAL - conteúdo 100% opaco */}
      <div
        className="fixed inset-0 z-50 flex justify-center items-center pointer-events-none"
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={e => e.stopPropagation()}
          onMouseDown={stop} 
          onMouseUp={stop}
          role="dialog" 
          aria-modal="true" 
          aria-label={title}
        >
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            <button 
              onClick={onClose} 
              className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700" 
              aria-label="Fechar"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </header>

          {/* Body */}
          <main className="p-6 overflow-y-auto">
            {children}
          </main>

          {/* Footer */}
          {footer && (
            <footer className="flex justify-end p-4 border-t dark:border-gray-700">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </>
  );
};

export default Modal;