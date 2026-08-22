// File: components/modals/OSSummaryModal.tsx
// Este componente usa a API do Google Gemini para gerar um resumo inteligente de uma Ordem de Serviço.

import React, { useState, useEffect } from 'react';
// Importa o cliente da API Gemini e o tipo de resposta para tipagem correta.
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { OS } from '../../types';
import Modal from './Modal';
import { useData } from '../../contexts/DataContext';

// Define as propriedades que o modal de resumo espera receber.
interface OSSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    os: OS; // A OS da qual o resumo será gerado.
}

const OSSummaryModal: React.FC<OSSummaryModalProps> = ({ isOpen, onClose, os }) => {
    // Acessa dados globais para obter nomes de usina e técnico.
    const { plants, users } = useData();
    // Estados para controlar o resumo, o carregamento e os erros.
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Busca os dados relacionados à OS.
    const plant = plants.find(p => p.id === os.plantId);
    const technician = users.find(u => u.id === os.technicianId);

    // `useEffect` que dispara a geração do resumo sempre que o modal é aberto.
    useEffect(() => {
        // Se o modal não estiver aberto, reseta os estados.
        if (!isOpen) {
            setSummary('');
            setError('');
            return;
        }

        // Função assíncrona para chamar a API Gemini.
        const generateSummary = async () => {
            setIsLoading(true);
            setError('');
            try {
                // Conforme as diretrizes, a chave da API é assumida como disponível em `process.env.API_KEY`.
                const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

                // Constrói o prompt detalhado para a IA, fornecendo todo o contexto da OS.
                const prompt = `Gere um resumo executivo conciso para a seguinte Ordem de Serviço (OS). O resumo deve ser em português e focado nos pontos chave para um gestor.
                
                **Dados da OS:**
                - **Título:** ${os.title}
                - **Status:** ${os.status}
                - **Prioridade:** ${os.priority}
                - **Usina:** ${plant?.name || 'N/A'} (${plant?.client || 'N/A'})
                - **Técnico Responsável:** ${technician?.name || 'N/A'}
                - **Data de Início:** ${new Date(os.startDate).toLocaleDateString()}
                - **Atividade Principal:** ${os.activity}
                - **Ativos Envolvidos:** ${os.assets.join(', ')}
                - **Descrição:** ${os.description}
                
                **Formato do Resumo:**
                Comece com "Resumo da OS #${os.id}".
                Destaque o problema principal, a ação necessária e o impacto esperado. Seja breve e direto.`;

                // Faz a chamada para a API e especifica o tipo de resposta esperado.
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', // Modelo recomendado para tarefas de texto rápidas.
                    contents: prompt,
                });
                // Extrai o texto da resposta.
                setSummary(response.text);

            } catch (err) {
                console.error("Error generating summary:", err);
                setError('Falha ao gerar o resumo. Verifique a conexão com a API ou a configuração da chave.');
                setSummary('Não foi possível gerar o resumo. Verifique a descrição da OS para mais detalhes.');
            } finally {
                setIsLoading(false);
            }
        };

        generateSummary();
    }, [isOpen, os, plant, technician]); // Dependências do efeito.

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Resumo Inteligente da OS: ${os.title}`}
        >
            {/* Renderização condicional com base no estado de carregamento e erro. */}
            {isLoading && (
                <div className="flex justify-center items-center p-8">
                    <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="ml-3 text-gray-700 dark:text-gray-300">Gerando resumo...</span>
                </div>
            )}
            {!isLoading && error && ( <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p> )}
            {!isLoading && ( <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap p-2">{summary}</div> )}
        </Modal>
    );
};

export default OSSummaryModal;
