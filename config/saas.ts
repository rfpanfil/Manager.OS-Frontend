export const SAAS_CONFIG = [
    { id: 'kanban', label: 'Painel Kanban', categoria: 'Operação' },
    { id: 'calendario', label: 'Calendário', categoria: 'Operação' },
    { id: 'cronograma', label: 'Cronograma 52 Semanas', categoria: 'Operação' },
    { id: 'planos', label: 'Planos de Manutenção', categoria: 'Operação' },
    { id: 'equipes', label: 'Gestão de Equipes', categoria: 'Equipes' },
    { id: 'usinas', label: 'Gestão de Usinas', categoria: 'Usinas' },
    { id: 'permissoes', label: 'Gestão de Permissões', categoria: 'Administração' },
    { id: 'auditoria', label: 'Log de Auditoria', categoria: 'Administração' }
];

export const TODOS_MODULOS = SAAS_CONFIG.map(modulo => modulo.id);
