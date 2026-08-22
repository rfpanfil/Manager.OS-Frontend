// File: components/PlantList.tsx
// Lista hierárquica Cliente → Usinas, com busca e ações.
// - onCreateForClient(client): dispara criação de usina com preset do cliente.
// - onEdit(plant): abre o formulário de edição da usina.

import React from 'react';
import { useData } from '@/contexts/DataContext';
import { Plant } from '@/types';

interface Props {
  onEdit: (p: Plant) => void;
  onCreateForClient: (client: string) => void;
}

const PlantList: React.FC<Props> = ({ onEdit, onCreateForClient }) => {
  const { plants } = useData();
  const [query, setQuery] = React.useState('');

  // Agrupa por cliente e ordena: primeiro clientes A..Z, dentro de cada cliente as usinas A..Z.
  const grouped = React.useMemo(() => {
    const map = new Map<string, Plant[]>();
    plants.forEach(p => {
      const key = p.client || 'Sem cliente';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    for (const [, list] of map) list.sort((a, b) => a.name.localeCompare(b.name));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [plants]);

  // Controle de expansão por cliente (mostra/esconde usinas)
  const [expandedClients, setExpandedClients] = React.useState<Set<string>>(new Set());
  const toggleClient = (client: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(client) ? next.delete(client) : next.add(client);
      return next;
    });
  };

  const q = query.trim().toLowerCase();

  return (
    <div className="space-y-6">
      {/* Busca unificada por cliente ou usina */}
      <div className="flex items-center">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por usina ou cliente..."
          className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Para cada cliente, mostra cabeçalho com ações e, se expandido, as usinas */}
      {grouped.map(([client, list]) => {
        // Se o cliente casa com a busca, mostramos todas as usinas dele
        const clientMatches = q && client.toLowerCase().includes(q);
        // Senão, filtramos as usinas pelo nome
        const filtered = clientMatches
          ? list
          : list.filter(p =>
              p.name.toLowerCase().includes(q) || (p.client || '').toLowerCase().includes(q)
            );

        if (filtered.length === 0) return null;

        const expanded = clientMatches || expandedClients.has(client);

        return (
          <div key={client} className="border-b dark:border-gray-700 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-300">{client}</h3>
              <div className="flex items-center gap-2">
                {/* Criação com preset do cliente */}
                <button
                  onClick={() => onCreateForClient(client)}
                  className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                  title="Nova usina para este cliente"
                >
                  + Nova Usina
                </button>
                {/* Expansão/colapso do grupo */}
                <button
                  onClick={() => toggleClient(client)}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-100 rounded"
                >
                  {expanded ? 'Ocultar' : 'Ver todas'}
                </button>
              </div>
            </div>

            {expanded && (
              <ul className="space-y-2">
                {filtered.map(p => (
                  <li key={p.id} className="p-3 flex items-center justify-between rounded-md border border-gray-700">
                    <div>
                      <div className="text-gray-100">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {p.subPlants.length} subusina(s) · {p.stringCount} strings · {p.trackerCount} trackers
                      </div>
                    </div>
                    <button
                      onClick={() => onEdit(p)}
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      Editar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PlantList;