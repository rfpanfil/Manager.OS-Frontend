// File: constants.ts
// Este arquivo define constantes globais que são usadas em várias partes da aplicação para manter a consistência.

import { OSStatus, Role } from './types';

export const ROLES = Object.values(Role);
export const OS_STATUSES = Object.values(OSStatus);

export const STATUS_COLORS: { [key in OSStatus]: string } = {
    [OSStatus.PENDING]: 'bg-yellow-500',
    [OSStatus.IN_PROGRESS]: 'bg-blue-500',
    [OSStatus.IN_REVIEW]: 'bg-purple-500',
    [OSStatus.COMPLETED]: 'bg-green-500',
};

export const STATUS_COLUMN_TITLES: { [key in OSStatus]: string } = {
    [OSStatus.PENDING]: 'OSs Pendentes',
    [OSStatus.IN_PROGRESS]: 'Em Execução',
    [OSStatus.IN_REVIEW]: 'Em Revisão',
    [OSStatus.COMPLETED]: 'Concluídas',
};

// ✅ LISTA ATUALIZADA BASEADA NO PLANO DE MANUTENÇÃO "LOOP"
export const DEFAULT_PLANT_ASSETS: string[] = [
    'Rotina de O&M',
    'Estação Solarimétrica',
    'Atividades de Limpeza e Roçagem',
    'Transformador a seco',
    'Transformador a óleo',
    'Inversores',
    'Subestação MT',
    'QGBT',
    'Trackers',
    'RSU/NCU',
    'SCADA',
    'Sala de Controle',
    'Aterramento',
    'Planta de Alarme e CFTV',
    'Vias de acesso',
    'Terreno',
    'Drenagem',
    'Cercamento',
    'Ar Condicionado',
    'NoBreak',
    'Relé de Proteção',
    'Sistema de Incêndio',
    'Frotas'
];

export const OS_ACTIVITIES: string[] = [
    'Manutenção Preventiva',
    'Manutenção Corretiva',
    'Manutenção Preditiva',
    'Inspeção',
    'Projeto',
    'Acompanhamento de Serviço',
    'Coleta de dados',
    'Melhoria & Adequação',
    'Serviços Gerais'
];

// ✅ LISTA PADRÃO CENTRALIZADA (Adicione isto ao arquivo)
export const STANDARD_ASSETS = [
    "Ar Condicionado",
    "Aterramento",
    "Atividades de Limpeza e Roçagem",
    "Cercamento",
    "Drenagem",
    "Estação Solarimétrica",
    "Frotas",
    "Inversores",
    "NoBreak",
    "Planta de Alarme e CFTV",
    "QGBT",
    "RSU/NCU",
    "Relé de Proteção",
    "Rotina de O&M",
    "SCADA",
    "Sala de Controle",
    "Sistema de Incêndio",
    "Subestação MT",
    "Terreno",
    "Trackers",
    "Transformador a seco",
    "Transformador a óleo",
    "Vias de acesso"
].sort();