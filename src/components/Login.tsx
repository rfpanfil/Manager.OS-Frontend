// File: components/Login.tsx
// Este componente renderiza a página de login da aplicação.
// Mantém comentários explicativos sobre cada bloco para facilitar manutenção futura.

import React, { useState } from 'react';
// Importa o hook `useAuth` para acessar a função de login e o estado de autenticação.
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  // Armazena o identificador digitado (pode ser usuário OU e‑mail).
  const [identifier, setIdentifier] = useState('');
  // Armazena a senha digitada.
  const [password, setPassword] = useState('');
  // Armazena mensagem de erro exibida ao usuário.
  const [error, setError] = useState('');
  // Acessa a função `login` do contexto de autenticação.
  const { login } = useAuth();

  /**
   * Manipulador do submit do formulário de login.
   * - Previne recarregamento de página.
   * - Limpa erros prévios.
   * - Aguarda a Promise de `login` para tratar sucesso/erro corretamente.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // Aguarda o login; identifier aceita usuário ou e‑mail.
      await login(identifier.trim(), password);
      // Sucesso: o AuthProvider atualiza `user` e o App.tsx troca para o Dashboard.
    } catch (err: any) {
      // Em caso de erro, exibe mensagem amigável.
      setError(err?.message || 'Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-800">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 shadow-lg rounded-xl p-8 space-y-8">
        {/* Cabeçalho do formulário com ícone e título */}
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          
          {/* AQUI ESTÁ A MUDANÇA: font-nunito e font-bold */}
          <h2 className="mt-6 text-3xl font-bold font-nunito text-gray-900 dark:text-white">
            loop.OS Manager
          </h2>
          
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Seja Bem-vindo(a)!</p>
        </div>

        {/* Formulário de login */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Campo de Identificação: aceita usuário OU e‑mail.
                Importante: type="text" evita a validação automática de e‑mail bloquear o submit. */}
            <div>
              <label htmlFor="identifier" className="sr-only">Usuário ou e‑mail</label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Usuário ou e‑mail"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            {/* Campo de Senha */}
            <div>
              <label htmlFor="password" className="sr-only">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Exibição de mensagem de erro, se houver */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Botão de Envio */}
          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Entrar
            </button>
          </div>

          {/* Dicas de login para facilitar testes (mock) */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
            <p>Para acessar o sistema, entre em contato com o COG via:</p>
            <p>E-mail: cog@loopservices.com.br</p>
            <p>
              Whatsapp:
              <a
                href="https://api.whatsapp.com/send/?phone=5541998330048"
                target="_blank" // Abre o link em uma nova aba
                rel="noopener noreferrer" // Recomendado para segurança ao usar target="_blank"
                className="ml-1 text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 font-medium" // Estilos Tailwind para o link
              >
                +55 (41) 99833-0048
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;