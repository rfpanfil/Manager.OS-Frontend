import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Search, Filter, FileText, Download, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import { useCan } from '../components/hooks/useCan';

// --- COMPONENTE AUXILIAR PARA RENDERIZAR OS DADOS MUDADOS (JSON) ---
function RenderJSON({ str }: { str?: string | null }) {
    if (!str || str === 'null') return <span className="text-gray-500">-</span>;
    try {
        const obj = JSON.parse(str);
        return (
            <div className="text-xs text-gray-200 bg-black/20 p-2 rounded-md break-all whitespace-pre-wrap">
                {Object.entries(obj)
                    .filter(([key]) => key !== 'senha_hash' && key !== 'password')
                    .map(([key, val]) => (
                        <div key={key}>
                            <strong className="text-gray-400">{key}:</strong> {String(val)}
                        </div>
                    ))}
            </div>
        );
    } catch (e) {
        return <span className="text-xs break-all">{str}</span>;
    }
}

export default function Auditoria() {
    const { token } = useAuth();
    const can = useCan();
    const [filtros, setFiltros] = useState({
        busca: '', usuario: '', tabela: '', acao: '', data_inicio: '', data_fim: ''
    });
    const [limite, setLimite] = useState(50);
    const [page, setPage] = useState(1);

    const { data: opcoes = { usuarios: [], tabelas: [], acoes: [] } } = useQuery({
        queryKey: ['auditoriaOpcoes'],
        queryFn: async () => {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/auditoria/filtros`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Erro ao buscar filtros');
            return res.json();
        },
        enabled: !!token
    });

    const { data: logsData, isLoading: carregando, refetch: carregarLogs } = useQuery({
        queryKey: ['auditoriaLogs', filtros.usuario, filtros.tabela, filtros.acao, filtros.data_inicio, filtros.data_fim, limite, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', limite.toString());
            if (filtros.busca) params.append('busca', filtros.busca);
            if (filtros.usuario) params.append('usuario_nome', filtros.usuario);
            if (filtros.tabela) params.append('tabela', filtros.tabela);
            if (filtros.acao) params.append('acao', filtros.acao);
            if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
            if (filtros.data_fim) params.append('data_fim', filtros.data_fim);

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/auditoria/?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Erro ao buscar logs');
            return res.json();
        },
        enabled: !!token
    });

    const logs = logsData?.items || [];
    const total = logsData?.total || 0;

    function handleBuscaTextual(e: React.FormEvent) {
        e.preventDefault();
        if (page !== 1) setPage(1);
        else carregarLogs();
    }

    function exportarExcel() {
        const headers = ["Data/Hora", "Usuário", "Ação", "Módulo (Tabela)", "ID Registro", "Dados Antigos", "Dados Novos"];
        
        const rows = logs.map((l: any) => [
            new Date(l.data_hora).toLocaleString('pt-BR'),
            l.usuario_nome || 'Sistema',
            l.acao,
            l.tabela,
            l.registro_id || '-',
            l.dados_antigos ? JSON.stringify(l.dados_antigos).replace(/"/g, '""') : '',
            l.dados_novos ? JSON.stringify(l.dados_novos).replace(/"/g, '""') : ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map((field: string) => `"${field}"`).join(','))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Auditoria_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportarPDF() {
        const doc = new jsPDF('landscape');
        doc.text("Relatório de Auditoria do Sistema", 14, 10);
        const tableRows = logs.map((l: any) => [
            new Date(l.data_hora).toLocaleString('pt-BR'),
            l.usuario_nome || 'Sistema',
            l.acao,
            l.tabela,
            l.registro_id || '-',
            l.dados_antigos && l.dados_antigos !== 'null' ? "Sim (Ver Excel)" : "-",
            l.dados_novos && l.dados_novos !== 'null' ? "Sim (Ver Excel)" : "-"
        ]);
        autoTable(doc, {
            head: [["Data/Hora", "Usuário", "Ação", "Tabela", "ID", "Tinha Dados Antigos", "Tinha Dados Novos"]],
            body: tableRows, startY: 15, styles: { fontSize: 8 }
        });
        doc.save(`Auditoria_${new Date().getTime()}.pdf`);
    }

    return (
        <div className="p-6 bg-gray-900 min-h-screen text-gray-200">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                        <ShieldAlert className="text-purple-400" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Auditoria</h1>
                </div>

                <div className="flex gap-3">
                    <select 
                        value={limite} 
                        onChange={e => setLimite(parseInt(e.target.value))} 
                        className="bg-gray-800 text-white border border-gray-700 p-2.5 rounded-lg outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="100">100 Registros</option>
                        <option value="500">500 Registros</option>
                        <option value="1000">1.000 Registros</option>
                        <option value="2000">2.000 Registros</option>
                        <option value="999999">Mostrar Tudo</option>
                    </select>

                    <button 
                        onClick={exportarExcel} 
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                        title="Baixar Planilha"
                    >
                        <Download size={18} /> Excel
                    </button>

                    <button 
                        onClick={exportarPDF} 
                        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <FileText size={18} /> PDF
                    </button>
                </div>
            </div>

            {/* --- BARRA DE FILTROS --- */}
            <div className="flex flex-wrap gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6 shadow-sm">
                <form onSubmit={handleBuscaTextual} className="flex items-center bg-gray-700 rounded-lg px-3 flex-1 min-w-[250px] focus-within:ring-2 focus-within:ring-purple-500">
                    <Search size={18} className="text-gray-400" />
                    <input
                        placeholder="Buscar em dados ou usuário (Enter para buscar)..."
                        value={filtros.busca}
                        onChange={e => setFiltros({ ...filtros, busca: e.target.value })}
                        className="bg-transparent border-none text-white p-2.5 outline-none w-full"
                    />
                </form>

                <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-gray-400 block mb-1">Usuário</label>
                    <select 
                        value={filtros.usuario} 
                        onChange={e => setFiltros({ ...filtros, usuario: e.target.value })} 
                        className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded-lg outline-none focus:border-purple-500"
                    >
                        <option value="">Todos</option>
                        {opcoes.usuarios.map((u: string) => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-gray-400 block mb-1">Módulo (Tabela)</label>
                    <select 
                        value={filtros.tabela} 
                        onChange={e => setFiltros({ ...filtros, tabela: e.target.value })} 
                        className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded-lg outline-none focus:border-purple-500"
                    >
                        <option value="">Todas</option>
                        {opcoes.tabelas.map((t: string) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="flex-1 min-w-[120px]">
                    <label className="text-xs text-gray-400 block mb-1">Tipo Ação</label>
                    <select 
                        value={filtros.acao} 
                        onChange={e => setFiltros({ ...filtros, acao: e.target.value })} 
                        className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded-lg outline-none focus:border-purple-500"
                    >
                        <option value="">Todas</option>
                        {opcoes.acoes.map((a: string) => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                <div className="flex gap-2 items-end">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Início</label>
                        <input 
                            type="date" 
                            value={filtros.data_inicio} 
                            onChange={e => setFiltros({ ...filtros, data_inicio: e.target.value })} 
                            className="p-2 bg-gray-700 text-white border border-gray-600 rounded-lg outline-none custom-date-input"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Fim</label>
                        <input 
                            type="date" 
                            value={filtros.data_fim} 
                            onChange={e => setFiltros({ ...filtros, data_fim: e.target.value })} 
                            className="p-2 bg-gray-700 text-white border border-gray-600 rounded-lg outline-none custom-date-input"
                        />
                    </div>
                </div>
            </div>

            {/* --- TABELA DE LOGS --- */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    {carregando ? (
                        <div className="flex flex-col items-center justify-center p-16 text-purple-400">
                            <Activity size={36} className="animate-spin mb-4" />
                            <p className="font-medium">Buscando rastros no banco de dados...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-gray-900 border-b border-gray-700">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-400 whitespace-nowrap w-[15%]">Data / Hora</th>
                                    <th className="p-4 font-semibold text-gray-400 w-[15%]">Usuário</th>
                                    <th className="p-4 font-semibold text-gray-400 w-[10%]">Ação</th>
                                    <th className="p-4 font-semibold text-gray-400 w-[15%]">Tabela (Módulo)</th>
                                    <th className="p-4 font-semibold text-gray-400 w-[5%]">ID</th>
                                    <th className="p-4 font-semibold text-gray-400 w-[20%]">Dados Anteriores</th>
                                    <th className="p-4 font-semibold text-gray-400 w-[20%]">Dados Novos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {logs.map((l: any) => (
                                    <tr key={l.id} className="hover:bg-gray-750 transition-colors">
                                        <td className="p-4 whitespace-nowrap text-gray-400">
                                            {new Date(l.data_hora).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-4 font-medium text-blue-400">{l.usuario_nome || 'Sistema'}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold inline-block
                                                ${l.acao === 'CREATE' ? 'bg-purple-500/10 text-purple-400' : 
                                                  l.acao === 'DELETE' ? 'bg-red-500/10 text-red-400' : 
                                                  'bg-orange-500/10 text-orange-400'}`}
                                            >
                                                {l.acao}
                                            </span>
                                        </td>
                                        <td className="p-4 uppercase text-gray-300 font-mono text-xs">{l.tabela}</td>
                                        <td className="p-4 font-mono text-xs text-gray-400">{l.registro_id?.substring(0, 8) || '-'}</td>
                                        <td className="p-4 max-w-[250px]">
                                            <RenderJSON str={typeof l.dados_antigos === 'object' ? JSON.stringify(l.dados_antigos) : l.dados_antigos} />
                                        </td>
                                        <td className="p-4 max-w-[250px]">
                                            <RenderJSON str={typeof l.dados_novos === 'object' ? JSON.stringify(l.dados_novos) : l.dados_novos} />
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center p-12 text-gray-500">
                                            Nenhum rastro encontrado com os filtros atuais.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* CONTROLES DE PAGINAÇÃO SERVER-SIDE */}
            {!carregando && total > 0 && (
                <div className="flex justify-between items-center flex-wrap gap-4 mt-6 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                    <div className="text-gray-400 text-sm">
                        Mostrando {(page - 1) * limite + 1} a {Math.min(page * limite, total)} de <strong className="text-white">{total}</strong> registros
                    </div>
                    
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                page === 1 
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                            }`}
                        >
                            Anterior
                        </button>
                        
                        <div className="flex items-center justify-center bg-gray-700 text-white px-4 rounded-lg font-bold min-w-[100px]">
                            Página {page}
                        </div>
                        
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page * limite >= total}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                page * limite >= total 
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                            }`}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
