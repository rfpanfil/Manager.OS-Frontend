import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { API_BASE } from '../components/utils/config';

// Simulando o toast já que a lib não está tipada aqui (você pode usar react-hot-toast se configurado no projeto)
const toast = {
    success: (msg: string) => alert(`✅ ${msg}`),
    error: (msg: string) => alert(`❌ ${msg}`)
};

export default function AdminPermissoes() {
    const { user, token } = useAuth();
    
    const [cargos, setCargos] = useState<any[]>([]);
    const [modulos, setModulos] = useState<any>({});
    const [matriz, setMatriz] = useState<any>({}); 
    const [cargoSelecionado, setCargoSelecionado] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [cargoParaEditar, setCargoParaEditar] = useState({ id: null as string | null, nome: '' });
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/permissoes/matriz`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Falha ao buscar matriz");
            const data = await res.json();
            
            setCargos(data.estrutura?.cargos || []);
            setModulos(data.estrutura?.modulos || {});
            setMatriz(data.matriz || {});
            
            if (data.estrutura?.cargos?.length > 0) {
                if (cargoSelecionado) {
                    const updatedCargo = data.estrutura.cargos.find((c: any) => c.id === cargoSelecionado.id);
                    setCargoSelecionado(updatedCargo || data.estrutura.cargos[0]);
                } else {
                    setCargoSelecionado(data.estrutura.cargos[0]);
                }
            } else {
                setCargoSelecionado(null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    if (!user) return <Navigate to="/" replace />;

    async function handleToggle(cargoId: string, permId: string, temPermissao: boolean) {
        // Atualização otimista
        const novaMatriz = { ...matriz };
        if (temPermissao) {
            novaMatriz[cargoId] = novaMatriz[cargoId].filter((id: string) => id !== permId);
        } else {
            novaMatriz[cargoId] = novaMatriz[cargoId] ? [...novaMatriz[cargoId], permId] : [permId];
        }
        setMatriz(novaMatriz);

        try {
            const res = await fetch(`${API_BASE}/api/permissoes/cargo/${cargoId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ permissao_id: permId, ativo: !temPermissao })
            });
            if (!res.ok) throw new Error("Erro da API");
        } catch (error) {
            toast.error("Erro ao salvar permissão.");
            fetchData(); // Reverte
        }
    }

    async function handleAddCargo() {
        const nome = prompt("Nome do Novo Cargo:");
        if (!nome) return;
        if (nome.trim().toLowerCase() === 'admin') {
            toast.error("O nome 'Admin' é reservado e não pode ser criado.");
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/users/cargos/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ nome })
            });
            if (!res.ok) throw new Error("Erro da API");
            toast.success(`Cargo '${nome}' criado!`);
            fetchData();
        } catch (error: any) {
            toast.error("Erro ao criar cargo.");
        }
    }

    async function confirmEditCargo() {
        if (!cargoParaEditar.nome || cargoParaEditar.nome.trim() === '') return;
        if (cargoParaEditar.nome.trim().toLowerCase() === 'admin') {
            toast.error("O nome 'Admin' é reservado e não pode ser utilizado.");
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/users/cargos/${cargoParaEditar.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ nome: cargoParaEditar.nome.trim() })
            });
            if (!res.ok) throw new Error("Erro da API");
            toast.success("Cargo atualizado!");
            setIsEditModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Erro ao editar cargo.");
        }
    }

    function openEditModal(cargoId: string, nomeAtual: string) {
        setCargoParaEditar({ id: cargoId, nome: nomeAtual });
        setIsEditModalOpen(true);
    }

    async function handleDeleteCargo(cargoId: string) {
        if (!confirm("Tem certeza que deseja excluir este cargo? Usuários atrelados precisarão ser reatribuídos.")) return;
        try {
            const res = await fetch(`${API_BASE}/api/users/cargos/${cargoId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro da API");
            toast.success("Cargo excluído!");
            fetchData();
        } catch (error) {
            toast.error("Erro ao excluir cargo.");
        }
    }

    if (loading) return <div className="p-8 text-gray-500">Carregando arquitetura de permissões...</div>;

    const isAdmin = cargoSelecionado?.nome?.toLowerCase() === 'admin';

    return (
        <div className="p-6 max-w-7xl mx-auto h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciamento de Permissões</h1>
                    <p className="text-gray-500 dark:text-gray-400">Controle de acesso isolado da empresa atual</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleAddCargo} 
                        className="bg-purple-600 hover:bg-purple-700 text-white h-10 px-4 rounded-lg flex items-center gap-2 font-medium transition-colors"
                    >
                        <PlusCircle size={18} /> Novo Cargo
                    </button>
                    {user?.role?.toLowerCase() === 'superadmin' && (
                        <button 
                            onClick={async () => {
                                await fetch(`${API_BASE}/api/permissoes/setup-inicial`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
                                fetchData();
                            }} 
                            className="bg-gray-600 hover:bg-gray-700 text-white h-10 px-4 rounded-lg font-medium transition-colors"
                        >
                            Restaurar Padrões
                        </button>
                    )}
                </div>
            </div>

            {/* SEÇÃO SUPERIOR: CARGOS (PÍLULAS) */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6 shadow-sm">
                <h3 className="text-gray-400 flex items-center gap-2 mb-4 font-medium text-sm">
                    <Shield size={18}/> Selecione o Cargo
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700">
                    {cargos.map(c => {
                        const isSelected = cargoSelecionado?.id === c.id;
                        return (
                            <div 
                                key={c.id} 
                                onClick={() => setCargoSelecionado(c)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all whitespace-nowrap border ${
                                    isSelected 
                                    ? 'bg-purple-600 text-white border-purple-500 font-bold' 
                                    : 'bg-gray-800 text-gray-300 border-gray-700 font-medium hover:bg-gray-700'
                                }`}
                            >
                                <span className="capitalize">{c.nome}</span>
                                {c.nome?.toLowerCase() !== 'admin' && (
                                    <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => openEditModal(c.id, c.nome)} 
                                            className={`p-1 rounded-md transition-colors ${isSelected ? 'text-purple-200 hover:text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCargo(c.id)} 
                                            className="p-1 rounded-md text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SEÇÃO INFERIOR: PERMISSÕES */}
            <div className="w-full pb-8">
                {cargoSelecionado ? (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-sm">
                        <div className="mb-6 pb-4 border-b border-gray-800">
                            <h2 className="text-xl font-bold text-white capitalize flex items-center gap-3">
                                Permissões: <span className="text-purple-500">{cargoSelecionado.nome}</span>
                                {isAdmin && <span className="text-xs bg-red-600 px-3 py-1 rounded-full text-white font-bold ml-2">Acesso Total</span>}
                            </h2>
                            <p className="text-gray-400 mt-2 text-sm">
                                {isAdmin ? 'O cargo de Administrador possui todas as permissões do sistema e não pode ser restrito.' : 'Ative ou desative as permissões específicas para este cargo.'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {Object.entries(modulos).map(([nomeModulo, permissoes]: [string, any]) => (
                                <div key={nomeModulo} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                                    <h3 className="text-purple-500 uppercase text-sm font-bold flex items-center gap-2 pb-3 mb-4 border-b border-gray-700">
                                        📂 {nomeModulo}
                                    </h3>
                                    
                                    <div className="flex flex-col gap-3">
                                        {permissoes.map((perm: any) => {
                                            const temPermissao = matriz[cargoSelecionado.id]?.includes(perm.id) || false;
                                            const checked = temPermissao || isAdmin;

                                            return (
                                                <div key={perm.id} className={`flex justify-between items-center py-2 ${isAdmin ? 'opacity-70' : 'opacity-100'}`}>
                                                    <div>
                                                        <div className="text-white font-medium text-sm">{perm.nome}</div>
                                                        <div className="text-gray-400 text-xs mt-0.5">{perm.slug}</div>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => !isAdmin && handleToggle(cargoSelecionado.id, perm.id, temPermissao)}
                                                        disabled={isAdmin}
                                                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${isAdmin ? 'cursor-not-allowed' : ''} ${checked ? 'bg-emerald-600' : 'bg-gray-600'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-7' : 'left-1'}`}/>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-64 bg-gray-900 rounded-xl border border-dashed border-gray-700 text-gray-500">
                        Selecione um cargo na barra superior para visualizar suas permissões.
                    </div>
                )}
            </div>

            {/* MODAL DE EDIÇÃO DE CARGO */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-4">
                            <Pencil size={20} className="text-purple-500"/> Editar Nome do Cargo
                        </h3>
                        <input 
                            type="text" 
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-shadow mb-6"
                            value={cargoParaEditar.nome}
                            onChange={(e) => setCargoParaEditar({...cargoParaEditar, nome: e.target.value})}
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmEditCargo}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
