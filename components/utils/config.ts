// File: /LOOPOS/components/utils/config.ts

// Se existir a variável no .env, usa ela. Se não, usa localhost como fallback.
//export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
//export const API_BASE = "";

import { Capacitor } from '@capacitor/core';

export const API_BASE = (() => {
  const envApiBase = import.meta.env.VITE_API_BASE;
  
  if (Capacitor.isNativePlatform()) {
    // Fallback para o APK caso não tenha a env no build
    return envApiBase || "https://cause-greetings-pick-comics.trycloudflare.com";
  }

  // No navegador (Vercel, Localhost)
  return envApiBase || 'http://localhost:8000';
})();