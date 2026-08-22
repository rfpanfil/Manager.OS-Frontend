// File: contexts/AuthContext.tsx
// ARQUIVO CORRIGIDO: Adicionado endereço IP fixo para funcionar no Android

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { useData } from './DataContext';


// 🔥 CONFIGURAÇÃO DO ENDEREÇO DO SERVIDOR (IP DO SEU PC)
import { API_BASE } from '../components/utils/config';
//const API_BASE = 'http://192.168.18.165:8000';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  switchCompany: (empresaId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) return JSON.parse(raw) as User;
    } catch { }
    return null;
  });
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const { setAuthHeaders, reloadFromAPI, clearData } = useData();

  useEffect(() => {
    // Recupera o token salvo
    const token = localStorage.getItem('token');
    if (user && token) {
      setAuthHeaders({ 
        'Authorization': `Bearer ${token}`,
        'X-User-Id': user.id, 
        'X-Role': user.role,
      });
      reloadFromAPI();
    }
  }, [user, setAuthHeaders, reloadFromAPI]);

  const login = async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      // 🔥 CORREÇÃO AQUI: Usando o endereço completo com IP
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: formData,
      });

      if (!res.ok) {
        // Se der erro, tenta ler o texto para saber o motivo, mas lança erro genérico
        throw new Error('Usuário ou senha inválidos');
      }

      const data = await res.json();
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);

    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    }
  };

  const switchCompany = async (empresaId: string) => {
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/api/empresas/trocar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ empresa_alvo: empresaId })
        });
        if (!res.ok) throw new Error("Erro ao trocar de empresa");
        
        const data = await res.json();
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        setToken(data.access_token);
        setUser(data.user);
        
        // Forçar atualização imediata do backend cache
        setAuthHeaders({ 
            'Authorization': `Bearer ${data.access_token}`,
            'X-User-Id': data.user.id, 
            'X-Role': data.user.role,
        });
        reloadFromAPI();
        
    } catch(err) {
        console.error("Context Switcher falhou:", err);
        alert("Falha ao trocar de empresa. Faça login novamente.");
    }
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    clearData();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, switchCompany }}>
      {children}
    </AuthContext.Provider>
  );
};