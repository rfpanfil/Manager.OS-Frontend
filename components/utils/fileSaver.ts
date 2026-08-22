// File: components/utils/fileSaver.ts
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Helper para gerar nome único (ex: relatorio(1).pdf)
const getUniqueFileName = async (originalName: string, directory: Directory): Promise<string> => {
  let fileName = originalName;
  let counter = 1;
  const namePart = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  const extPart = fileName.substring(fileName.lastIndexOf('.'));

  while (true) {
    try {
      // Tenta ler os detalhes do arquivo. Se conseguir, é porque existe.
      await Filesystem.stat({
        path: fileName,
        directory: directory
      });
      // Se chegou aqui, o arquivo existe. Gera novo nome e repete o loop.
      fileName = `${namePart}(${counter})${extPart}`;
      counter++;
    } catch (e) {
      // Se der erro no stat, significa que o arquivo NÃO existe (404).
      // Então esse nome está livre para usar.
      break;
    }
  }
  return fileName;
};

export const saveFile = async (fileName: string, dataBase64: string, contentType: string = 'application/pdf') => {
  console.log(`💾 Tentando salvar: ${fileName} (${contentType})`);

  // 1. WEB: Download normal (Mantém comportamento padrão do navegador)
  if (!Capacitor.isNativePlatform()) {
    try {
      const byteCharacters = atob(dataBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      return;
    } catch (e) {
      console.error("Erro no download Web:", e);
      alert("Erro ao baixar no navegador.");
    }
  }

  // 2. MOBILE (Android/iOS): Verifica duplicidade antes de salvar
  try {
    const uniqueName = await getUniqueFileName(fileName, Directory.Documents);

    const result = await Filesystem.writeFile({
      path: uniqueName,
      data: dataBase64,
      directory: Directory.Documents,
    });
    
    console.log("✅ Arquivo salvo:", result.uri);
    alert(`Arquivo salvo em Documentos!\nNome: ${uniqueName}`);
  } catch (e: any) {
    console.error("❌ Erro ao salvar arquivo mobile:", e);
    alert("Erro ao salvar arquivo no celular: " + e.message);
  }
};