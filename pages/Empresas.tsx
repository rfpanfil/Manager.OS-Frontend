import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { API_BASE } from '../components/utils/config';
import { SAAS_CONFIG, TODOS_MODULOS } from '../config/saas';

interface Empresa {
    id: string;
    name: string;
    cnpj?: string;
    status?: string;
    modulos_ativos?: string[];
}

const Empresas: React.FC = () => {
    const { user, token } = useAuth();
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
    
    const initialForm = { 
        name: '', 
        cnpj: '', 
        status: 'Ativo', 
        modulos_ativos: TODOS_MODULOS 
    };
    
    const [formData, setFormData] = useState<{
        name: string;
        cnpj: string;
        status: string;
        modulos_ativos: string[];
    }>(initialForm);
    
    const [isSaving, setIsSaving] = useState(false);

    const fetchEmpresas = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/empresas/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha ao buscar empresas');
            const data = await res.json();
            setEmpresas(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user?.is_superadmin && token) {
            fetchEmpresas();
        }
    }, [user, token]);

    if (!user?.is_superadmin) return <Navigate to="/" replace />;

    const handleOpenModal = (empresa: Empresa | null = null) => {
        setEditingEmpresa(empresa);
        setFormData({
            name: empresa ? empresa.name : '',
            cnpj: empresa?.cnpj || '',
            status: empresa?.status || 'Ativo',
            modulos_ativos: empresa?.modulos_ativos || TODOS_MODULOS
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEmpresa(null);
        setFormData(initialForm);
    };

    const toggleModulo = (moduloId: string) => {
        setFormData(prev => {
            const isChecked = prev.modulos_ativos.includes(moduloId);
            const novosModulos = isChecked 
                ? prev.modulos_ativos.filter(id => id !== moduloId)
                : [...prev.modulos_ativos, moduloId];
            return { ...prev, modulos_ativos: novosModulos };
        });
    };

    const categorias = Array.from(new Set(SAAS_CONFIG.map(m => m.categoria)));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const url = editingEmpresa 
                ? `${API_BASE}/api/empresas/${editingEmpresa.id}`
                : `${API_BASE}/api/empresas/`;
            const method = editingEmpresa ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Falha ao salvar empresa');
            await fetchEmpresas();
            handleCloseModal();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar a empresa.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Atenção: Você tem certeza que deseja excluir a empresa "${name}"?`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/empresas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha ao excluir empresa');
            await fetchEmpresas();
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir a empresa.");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modo Deus (Super Admin)</h1>
                        <p className="text-gray-500 dark:text-gray-400">Gerenciamento global de empresas e faturamento</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 flex items-center gap-2 rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} />
                    <span>Nova Empresa</span>
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">ID</th>
                                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Nome Fantasia</th>
                                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">CNPJ</th>
                                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-sm text-center">Status</th>
                                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-sm text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">Carregando empresas...</td>
                                </tr>
                            ) : empresas.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">Nenhuma empresa encontrada.</td>
                                </tr>
                            ) : (
                                empresas.map(empresa => {
                                    const isAtivo = empresa.status?.toLowerCase() === 'ativo';
                                    return (
                                        <tr key={empresa.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="p-4 text-xs font-mono text-gray-500 dark:text-gray-400">
                                            {empresa.id.split('-')[0]}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-900 dark:text-white">{empresa.name}</td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                            {empresa.cnpj || 'Não Informado'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                                isAtivo
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                            }`}>
                                                {isAtivo ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                                                {empresa.status || 'Ativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button 
                                                onClick={() => handleOpenModal(empresa)}
                                                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors inline-flex"
                                                title="Editar"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(empresa.id, empresa.name)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-flex"
                                                title="Excluir"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Enriquecido */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                        
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingEmpresa ? 'Editar Empresa' : 'Configurar Nova Empresa'}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Configure o faturamento e os módulos SaaS ativos para este cliente.</p>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="empresa-form" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nome Fantasia / Razão Social *
                                        </label>
                                        <input 
                                            type="text" required autoFocus
                                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            CNPJ
                                        </label>
                                        <input 
                                            type="text" placeholder="00.000.000/0001-00"
                                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={formData.cnpj}
                                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Status do Cliente
                                        </label>
                                        <select 
                                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        >
                                            <option value="Ativo">🟢 Ativo (Acesso Liberado)</option>
                                            <option value="Inadimplente">🟡 Inadimplente (Acesso Restrito)</option>
                                            <option value="Inativo">🔴 Inativo (Bloqueado)</option>
                                        </select>
                                    </div>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                                    Páginas Contratadas (SaaS)
                                </h3>
                                
                                <div className="space-y-6">
                                    {categorias.map(categoria => (
                                        <div key={categoria} className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                            <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                                {categoria}
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {SAAS_CONFIG.filter(m => m.categoria === categoria).map(modulo => {
                                                    const isAtivo = formData.modulos_ativos.includes(modulo.id);
                                                    return (
                                                        <label 
                                                            key={modulo.id} 
                                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                                isAtivo 
                                                                ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' 
                                                                : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 opacity-70 hover:opacity-100'
                                                            }`}
                                                        >
                                                            <div className="relative flex items-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
                                                                    checked={isAtivo}
                                                                    onChange={() => toggleModulo(modulo.id)}
                                                                />
                                                            </div>
                                                            <span className={`text-sm font-medium ${isAtivo ? 'text-purple-900 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                                {modulo.label}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/80 rounded-b-xl mt-auto">
                            <button 
                                type="button" 
                                onClick={handleCloseModal}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                form="empresa-form"
                                disabled={isSaving}
                                className="px-5 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Empresas;
