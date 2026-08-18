// File: /LOOPOS/components/utils/config.ts

// Se existir a variável no .env, usa ela. Se não, usa localhost como fallback.
//export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
//export const API_BASE = "";

import { Capacitor } from '@capacitor/core';

// 1. URL do Cloudflare (Para acessar de qualquer lugar: 4G, 5G, Wi-Fi fora de casa)
const CLOUDFLARE_URL = "https://cause-greetings-pick-comics.trycloudflare.com";

// 2. IP da sua Rede (Para acessar super rápido via Wi-Fi em casa)
// ⚠️ IMPORTANTE: Nunca use 'localhost' aqui. Use o IP do PC (192.168...)
const LOCAL_IP = "http://192.168.18.191:8000";

export const API_BASE = (() => {
  // 📱 CASO 1: APP NATIVO (Android/iOS) instalados
  if (Capacitor.isNativePlatform()) {
    // Recomendação: Use o Cloudflare para garantir que funciona sempre.
    return CLOUDFLARE_URL; 
    
    // Se quiser economizar banda e usar só em casa, descomente a linha abaixo:
    // return LOCAL_IP;
  }

  // 🟢 CASO 2: NAVEGADOR (Chrome, Firefox, Edge, Safari)
  // Se estiver na Vercel (Produção), usa a variável de ambiente VITE_API_BASE
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // Retorna vazio ("") para usar caminho relativo.
  // Isso resolve o problema de Mixed Content e CORS automaticamente.
  return "";
})();