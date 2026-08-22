// File: components/utils/zipService.ts
import JSZip from 'jszip';
import { OS } from '../../types';
import { generateOSReport } from './pdfGenerator';
import { API_BASE } from './config';

// Helper para baixar arquivo como Blob
const fetchFileBlob = async (url: string): Promise<Blob | null> => {
    try {
        // Resolve URL completa se for relativa
        let finalUrl = url.trim();
        if (!finalUrl.startsWith('http') && !finalUrl.startsWith('data:')) {
             finalUrl = `${API_BASE}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
        }
        
        console.log(`📦 [ZIP] Baixando: ${finalUrl}`);
        const response = await fetch(finalUrl);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        return await response.blob();
    } catch (error) {
        console.error("Erro ao baixar arquivo para ZIP:", url, error);
        return null;
    }
};

// Helper para limpar nome de pastas
const cleanName = (name: string) => name.replace(/[^a-zA-Z0-9 \-_à-úÀ-ÚçÇ]/g, '').trim();

export const generateOSZipPackage = async (
    os: OS, 
    helpers: { getPlantName: (id: string) => string, getUserName: (id: string) => string }
): Promise<string> => {
    const zip = new JSZip();
    
    // 1. Cria Pasta Raiz da OS
    const osFolderName = `${os.id} - ${cleanName(os.activity || 'Sem Titulo')}`;
    const rootFolder = zip.folder(osFolderName);
    
    if (!rootFolder) throw new Error("Falha ao criar pasta ZIP");

    // 2. Gera e Adiciona o Relatório PDF na raiz
    console.log("📄 Gerando PDF do relatório...");
    const doc = await generateOSReport([os], `Relatório - ${os.id}`, helpers, false);
    const pdfBlob = doc.output('blob');
    rootFolder.file(`Relatorio_${os.id}.pdf`, pdfBlob);

    // 3. Estrutura de Pastas para Anexos
    if (os.imageAttachments && os.imageAttachments.length > 0) {
        const attachmentsFolder = rootFolder.folder("Anexos");
        
        if (attachmentsFolder) {
            console.log(`📂 Processando ${os.imageAttachments.length} anexos...`);
            
            for (const att of os.imageAttachments) {
                if (!att.url) continue;

                // Padrão: Pasta "Geral" para fotos soltas
                let subFolderName = "Geral";
                
                if (att.caption) {
                    // Verifica se é de um item de checklist (Ex: "Item 1 - Verificar...")
                    // O regex busca "Item" seguido de número
                    const match = att.caption.match(/Item\s+(\d+)/i);
                    
                    if (match) {
                        // ✅ CORREÇÃO AQUI: Troca "Item X" por "Subtarefa X"
                        // Substitui a palavra "Item" por "Subtarefa" mantendo o resto do texto para contexto
                        let folderName = att.caption.replace(/Item\s+/i, 'Subtarefa ');
                        subFolderName = cleanName(folderName).substring(0, 60); // Limita tamanho
                    } else {
                        // Se tiver legenda mas não for item numerado, usa a legenda como nome da pasta
                        subFolderName = cleanName(att.caption).substring(0, 30);
                    }
                }

                const targetFolder = attachmentsFolder.folder(subFolderName);
                
                // Baixa o arquivo real
                const blob = await fetchFileBlob(att.url);
                
                if (blob && targetFolder) {
                    // Usa o nome original ou gera um com extensão correta
                    let fileName = att.fileName || `anexo_${Date.now()}`;
                    
                    if (!fileName.includes('.')) {
                        const ext = blob.type.split('/')[1] || 'bin';
                        fileName = `${fileName}.${ext}`;
                    }

                    targetFolder.file(fileName, blob);
                }
            }
        }
    }

    // 4. Retorna ZIP em Base64
    console.log("📦 Compactando arquivo ZIP...");
    return await zip.generateAsync({ type: "base64" });
};