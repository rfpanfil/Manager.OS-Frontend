import { useQuery } from '@tanstack/react-query';

export interface PaginatedOSResponse {
    items: any[]; // Substitua por OSType depois, se disponível
    total: number;
    page: number;
    page_size: number;
}

import { API_BASE } from '../utils/config';

const fetchOSList = async (page: number, pageSize: number): Promise<PaginatedOSResponse> => {
    
    // Obtendo tokens e headers (Compatibilidade híbrida atual JWT/Legacy)
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('currentUser');
    const user = userJson ? JSON.parse(userJson) : null;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (user && user.id) headers['X-User-Id'] = user.id;

    const response = await fetch(`${API_BASE}/api/os?legacy=false&page=${page}&page_size=${pageSize}`, {
        headers
    });
    
    if (!response.ok) {
        throw new Error('Erro ao buscar a lista de OS');
    }
    
    return response.json();
};

export const useOSList = (page = 1, pageSize = 50) => {
    const userJson = localStorage.getItem('currentUser');
    const user = userJson ? JSON.parse(userJson) : null;
    const companyId = user ? user.company_id : 'default';

    return useQuery({
        queryKey: ['osList', companyId, page, pageSize],
        queryFn: () => fetchOSList(page, pageSize),
    });
};
