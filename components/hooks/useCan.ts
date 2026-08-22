import { useAuth } from '../../contexts/AuthContext';
import { Role } from '../../types';

export const useCan = () => {
    const { user } = useAuth();

    return (slug: string): boolean => {
        if (!user) return false;
        
        // Passe-livre absoluto
        if (user.is_superadmin === true) return true;
        
        // Verifica se o slug está no array de permissões do usuário
        if (user.permissions && Array.isArray(user.permissions)) {
            return user.permissions.includes(slug);
        }
        
        return false;
    };
};
