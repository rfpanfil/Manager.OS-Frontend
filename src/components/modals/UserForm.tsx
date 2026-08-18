// File: components/modals/UserForm.tsx
// Este componente renderiza um formulário modal para criar ou editar usuários.
// ATUALIZAÇÃO: Usa diretamente o Contexto (addUser/updateUser) para salvar, eliminando erro de onSave.

import React, { useState, useMemo } from 'react';
import { User, Role, Plant } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface UserFormProps {
    user?: User; // Se undefined, é criação de novo usuário
    role?: Role; // Role pré-selecionada vinda do ManagementModal
    onClose: () => void;
    isOpen: boolean;
}

// Mapeamento de labels para exibição no Select
const roleLabels: Partial<Record<string, string>> = {
    [Role.ADMIN]: "Administrador",
    [Role.COORDINATOR]: "Coordenador",
    [Role.SUPERVISOR]: "Supervisor",
    [Role.OPERATOR]: "Operador",
    [Role.TECHNICIAN]: "Técnico",
    [Role.ASSISTANT]: "Auxiliar",
    [Role.CLIENT]: "Cliente",
};

const UserForm: React.FC<UserFormProps> = ({ 
    user: propUser, 
    role: initialRole, 
    onClose, 
    isOpen 
}) => {
    const { addUser, updateUser, plants } = useData();
    const { user: currentUser } = useAuth(); 

    const isEditing = !!propUser;
    
    // Inicializa o formulário. Prioridade: Usuário Existente > Role Clicada > Padrão (Técnico)
    const [formData, setFormData] = useState<Partial<User>>({
        name: propUser?.name || '',
        username: propUser?.username || '',
        email: propUser?.email || '',
        phone: propUser?.phone || '',
        role: propUser?.role || initialRole || Role.TECHNICIAN, 
        password: '',
        plantIds: propUser?.plantIds || []
    });

    const [isSaving, setIsSaving] = useState(false);
    
    // Estado para controlar quais grupos de usinas (por cliente) estão expandidos
    const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

    if (!isOpen) return null;

    // --- REGRAS DE PERMISSÃO E VISIBILIDADE ---

    // 1. Verifica se é um cargo global (Admin/Operador não possuem usinas específicas vinculadas)
    const isGlobalRole = formData.role === Role.ADMIN || formData.role === Role.OPERATOR;

    // 2. Verifica se o usuário atual tem permissão para editar atribuições de usina
    // Geralmente apenas Admins e Operadores podem redistribuir pessoas entre usinas.
    // Se um usuário comum (Técnico/Supervisor) edita a si mesmo, ele NÃO pode mudar suas usinas.
    const canEditAssignments = useMemo(() => {
        if (!currentUser) return false;
        return currentUser.role === Role.ADMIN || currentUser.role === Role.OPERATOR;
    }, [currentUser]);

    // 3. Regra Final de Exibição do Campo:
    // - Não mostramos para cargos globais (pois eles têm acesso total por padrão).
    // - Não mostramos se o usuário logado NÃO tiver permissão de editar (solicitação do usuário).
    const showPlantSection = !isGlobalRole && canEditAssignments;

    // Agrupa as usinas por Cliente para facilitar a visualização no checkbox
    const groupedPlants = useMemo(() => {
        const groups: Record<string, Plant[]> = {};
        plants.forEach(plant => {
            const clientName = plant.client || 'Sem Cliente';
            if (!groups[clientName]) groups[clientName] = [];
            groups[clientName].push(plant);
        });
        return groups;
    }, [plants]);

    const toggleClientExpansion = (client: string) => {
        setExpandedClients(prev => ({ ...prev, [client]: !prev[client] }));
    };

    const togglePlant = (plantId: string) => {
        if (!canEditAssignments) return; 
        setFormData(prev => {
            const current = prev.plantIds || [];
            if (current.includes(plantId)) {
                return { ...prev, plantIds: current.filter(id => id !== plantId) };
            } else {
                return { ...prev, plantIds: [...current, plantId] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (isEditing && propUser?.id) {
                await updateUser({ ...propUser, ...formData } as User);
            } else {
                await addUser(formData as any);
            }
            onClose();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar usuário.");
        } finally {
            setIsSaving(false);
        }
    };

    // Estilos padrão dos inputs
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
    const inputClass = "w-full p-2 border rounded text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header do Modal */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
                    </h2>
                </div>

                {/* Corpo do Formulário */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Nome Completo</label>
                            <input 
                                required 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Usuário (Login)</label>
                            <input 
                                required 
                                value={formData.username} 
                                onChange={e => setFormData({...formData, username: e.target.value})}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>E-mail (Opcional)</label>
                            <input 
                                type="email"
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Telefone</label>
                            <input 
                                value={formData.phone} 
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Cargo / Função</label>
                            <select 
                                value={formData.role} 
                                onChange={e => setFormData({...formData, role: e.target.value as Role})}
                                className={inputClass}
                                // Impede alteração de cargo se for o próprio usuário (exceto Admin)
                                disabled={currentUser?.id === propUser?.id && currentUser?.role !== Role.ADMIN}
                            >
                                {Object.entries(roleLabels).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Senha {isEditing && '(Deixe em branco para manter)'}</label>
                            <input 
                                type="password"
                                value={formData.password} 
                                onChange={e => setFormData({...formData, password: e.target.value})}
                                className={inputClass}
                                placeholder={isEditing ? "******" : "Senha inicial"}
                                required={!isEditing}
                            />
                        </div>
                    </div>

                    {/* ✅ SEÇÃO DE USINAS (CONDICIONAL) */}
                    {/* Só aparece se NÃO for cargo global E se o usuário logado tiver permissão de editar atribuições */}
                    {showPlantSection && (
                        <div className="mt-6 border-t dark:border-gray-700 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                    Usinas Atribuídas
                                </label>
                                <span className="text-xs text-gray-500">
                                    Selecione as usinas permitidas para este usuário
                                </span>
                            </div>
                            
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700">
                                {Object.entries(groupedPlants).map(([clientName, clientPlants]) => {
                                    const isExpanded = expandedClients[clientName];
                                    
                                    return (
                                        <div key={clientName} className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 overflow-hidden">
                                            {/* Cabeçalho do Cliente (Accordion) */}
                                            <button 
                                                type="button"
                                                onClick={() => toggleClientExpansion(clientName)}
                                                className="w-full flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left"
                                            >
                                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                                    {clientName} ({clientPlants.length})
                                                </span>
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>

                                            {/* Lista de Checkboxes */}
                                            {isExpanded && (
                                                <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {clientPlants.map(plant => {
                                                        const isChecked = formData.plantIds?.includes(plant.id);
                                                        return (
                                                            <label 
                                                                key={plant.id} 
                                                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-sm
                                                                    ${isChecked 
                                                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent'}
                                                                `}
                                                            >
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => togglePlant(plant.id)}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-gray-700 dark:text-gray-300 truncate">
                                                                    {plant.name}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded font-medium dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow transition-colors flex items-center gap-2"
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Usuário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserForm;