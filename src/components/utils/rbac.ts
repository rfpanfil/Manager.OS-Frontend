// File: components/utils/rbac.ts
import { Role, Plant, User } from '@/types';

export type Ctx = { me: User; plants: Plant[] };

const isUserInPlant = (userId: string, p: Plant): boolean =>
  !!(
    p.coordinatorId === userId ||
    p.supervisorIds?.includes(userId) ||
    p.technicianIds?.includes(userId) ||
    p.assistantIds?.includes(userId)
  );

const shareAnyPlant = (aId: string, bId: string, plants: Plant[]) =>
  plants.some(p => isUserInPlant(aId, p) && isUserInPlant(bId, p));

/**
 * Visualização de usuários seguindo a hierarquia:
 * - Admin: todos
 * - Operador: todos
 * - Coordenador: supervisor/técnico/auxiliar que compartilha usina; não Admin
 * - Supervisor: técnico/auxiliar que compartilha usina; não Admin/Coordenador
 * - Técnico: apenas Auxiliar que compartilha usina
 * - Auxiliar: apenas Técnico que compartilha usina (visualização apenas)
 */
export const canViewUser = (ctx: Ctx, target: User, plantScope?: Plant[]): boolean => {
  const { me, plants: allPlants } = ctx;
  const scope = plantScope || allPlants;
  
  // ✅ NOVO: Qualquer um vê a si mesmo
  if (me.id === target.id) return true;
  
  // Normalizar roles para comparação (string → enum)
  const normalizeRole = (r: unknown) => {
    if (typeof r === 'string') {
      const upper = r.toUpperCase();
      if (upper === 'ADMIN') return Role.ADMIN;
      if (upper === 'COORDINATOR') return Role.COORDINATOR;
      if (upper === 'SUPERVISOR') return Role.SUPERVISOR;
      if (upper === 'OPERATOR') return Role.OPERATOR;
      if (upper === 'TECHNICIAN') return Role.TECHNICIAN;
      if (upper === 'ASSISTANT') return Role.ASSISTANT;
    }
    return r as Role;
  };

  const meRole = normalizeRole(me.role);
  const targetRole = normalizeRole(target.role);
  
  if (meRole === Role.ADMIN) return true;
  if (meRole === Role.OPERATOR) return true;
  
  if (meRole === Role.COORDINATOR) {
    if (targetRole === Role.ADMIN) return false;
    return [Role.SUPERVISOR, Role.TECHNICIAN, Role.ASSISTANT].includes(targetRole) &&
           shareAnyPlant(me.id, target.id, scope);
  }
  
  if (meRole === Role.SUPERVISOR) {
    if ([Role.ADMIN, Role.COORDINATOR].includes(targetRole)) return false;
    return [Role.TECHNICIAN, Role.ASSISTANT].includes(targetRole) &&
           shareAnyPlant(me.id, target.id, scope);
  }
  
  if (meRole === Role.TECHNICIAN) {
    return targetRole === Role.ASSISTANT && shareAnyPlant(me.id, target.id, scope);
  }
  
  if (meRole === Role.ASSISTANT) {
    return targetRole === Role.TECHNICIAN && shareAnyPlant(me.id, target.id, scope);
  }
  
  return false;
};

/**
 * Edição de usuários (regras mais restritas):
 * - Admin: edita todos
 * - Operador: edita Técnico/Auxiliar apenas
 * - Coordenador: edita Supervisor/Técnico/Auxiliar que compartilha usina
 * - Supervisor: edita Técnico/Auxiliar que compartilha usina
 * - Técnico: edita Auxiliar que compartilha usina
 * - Auxiliar: não edita ninguém
* ✅ NOVO: Qualquer um pode editar suas próprias informações
 */
export const canEditUser = (ctx: Ctx, target: User, plantScope: Plant[]): boolean => {
  const { me } = ctx;
  
  // ✅ ADICIONE ISTO: Qualquer um pode editar a si mesmo
  if (me.id === target.id) return true;
  
  // Normalizar roles
  const normalizeRole = (r: unknown) => {
    if (typeof r === 'string') {
      const upper = r.toUpperCase();
      if (upper === 'ADMIN') return Role.ADMIN;
      if (upper === 'COORDINATOR') return Role.COORDINATOR;
      if (upper === 'SUPERVISOR') return Role.SUPERVISOR;
      if (upper === 'OPERATOR') return Role.OPERATOR;
      if (upper === 'TECHNICIAN') return Role.TECHNICIAN;
      if (upper === 'ASSISTANT') return Role.ASSISTANT;
    }
    return r as Role;
  };

  const meRole = normalizeRole(me.role);
  const targetRole = normalizeRole(target.role);
  
  if (meRole === Role.ADMIN) return true;
  if (meRole === Role.OPERATOR) return [Role.TECHNICIAN, Role.ASSISTANT].includes(targetRole);
  
  if (meRole === Role.COORDINATOR) {
    return [Role.SUPERVISOR, Role.TECHNICIAN, Role.ASSISTANT].includes(targetRole) &&
           shareAnyPlant(me.id, target.id, plantScope);
  }
  
  if (meRole === Role.SUPERVISOR) {
    return [Role.TECHNICIAN, Role.ASSISTANT].includes(targetRole) &&
           shareAnyPlant(me.id, target.id, plantScope);
  }
  
  if (meRole === Role.TECHNICIAN) {
    return targetRole === Role.ASSISTANT && shareAnyPlant(me.id, target.id, plantScope);
  }
  
  return false;
};

/**
 * Visualização de usinas:
 * - Admin/Operador: todas
 * - Coordenador/Supervisor/Técnico/Auxiliar: apenas vinculadas
 */
export const canViewPlant = (ctx: Ctx, plant: Plant): boolean => {
  if ([Role.ADMIN, Role.OPERATOR].includes(ctx.me.role as Role)) return true;
  return isUserInPlant(ctx.me.id, plant);
};

/**
 * Edição de usinas:
 * - Admin/Operador: todas
 * - Coordenador/Supervisor: as que estão vinculados
 * - Técnico/Auxiliar: nenhuma
 */
export const canEditPlant = (ctx: Ctx, plant: Plant): boolean => {
  const meRole = ctx.me.role as Role;
  if ([Role.ADMIN, Role.OPERATOR].includes(meRole)) return true;
  if ([Role.COORDINATOR, Role.SUPERVISOR].includes(meRole)) return isUserInPlant(ctx.me.id, plant);
  return false;
};