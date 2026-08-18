// File: components/Portal.tsx
// Renderiza children fora da árvore atual para isolar de re-renders do pai.
import React from 'react';
import { createPortal } from 'react-dom';

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const elRef = React.useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement('div');
    document.body.appendChild(elRef.current);
  }
  React.useEffect(() => {
    const node = elRef.current!;
    return () => { if (node && node.parentNode) node.parentNode.removeChild(node); };
  }, []);
  return createPortal(children, elRef.current);
};

export default Portal;