// File: types.ts
// Este arquivo centraliza todas as definições de tipos e interfaces TypeScript.

export type ViewType = 'KANBAN' | 'CALENDAR' | 'SCHEDULE_52_WEEKS' | 'MAINTENANCE_PLANS';

export enum Role {
  ADMIN = "Admin",
  COORDINATOR = "Coordenador",
  SUPERVISOR = "Supervisor",
  OPERATOR = "Operador",
  TECHNICIAN = "Técnico",
  ASSISTANT = "Auxiliar",
  CLIENT = "Cliente",
}

export enum OSStatus {
    PENDING = 'Pendente',
    IN_PROGRESS = 'Em Progresso',
    IN_REVIEW = 'Em Revisão',
    COMPLETED = 'Concluído',
}

export enum Priority {
    LOW = 'Baixa',
    MEDIUM = 'Média',
    HIGH = 'Alta',
    URGENT = 'Urgente',
}

export interface User {
    id: string;
    name: string;
    username: string;
    email?: string;
    phone: string;
    role: Role;
    can_login?: boolean;
    supervisorId?: string;
    password?: string;
    plantIds?: string[];
}

export interface SubPlant {
    id: string; 
    name: string;
    inverterCount: number;
    inverterStartIndex?: number;
    trackersPerInverter: number;
    stringsPerInverter: number;
}

export interface Plant {
    id: string;
    client?: string; 
    name: string;
    stringCount: number;
    trackerCount: number;
    subPlants: SubPlant[];
    assets: string[];
    coordinatorId?: string | null;
    supervisorIds?: string[];
    technicianIds?: string[];
    assistantIds?: string[];
}

export interface OSLog {
    id: string;
    timestamp: string;
    authorId: string;
    comment: string;
}

export interface ImageAttachment {
    id: string;
    url: string;
    fileName?: string; 
    caption?: string; 
    uploadedBy?: string;
    uploadedAt: string;
}

export interface SubtaskItem {
    id: number;
    text: string;
    done: boolean;
    comment?: string;
}

export interface ExecutionSession {
    sessionId: string;
    userId: string;
    userName: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
    completedSubtasks?: string[]; 
    syncedFromOffline?: boolean;
}

export interface OS {
    id: string;
    title: string;
    description: string;
    status: OSStatus;
    priority: Priority;
    plantId: string;
    technicianId: string;
    supervisorId: string;
    assistantId: string;
    assets: string[]; 
    activity: string;
    startDate: string;
    endDate?: string;
    logs: OSLog[];
    attachmentsEnabled: boolean;
    imageAttachments: ImageAttachment[];
    
    // ✅ CORREÇÃO: Adicionados campos de timestamp que faltavam
    createdAt?: string;
    updatedAt?: string;

    executionStart?: string;
    executionTimeSeconds?: number;
    currentExecutorId?: string | null;
    executionHistory?: ExecutionSession[];
    isInReview?: boolean;
    subtasksStatus?: SubtaskItem[]; 
    maintenancePlanId?: string;
    subPlantId?: string;
    inverterId?: string;
    classification1?: string;
    classification2?: string;
    plannedDowntime?: number;
    estimatedDuration?: number;
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    read: boolean;
    timestamp: string;
}

export interface TaskTemplate {
    id: string;
    plan_code: string;
    asset_category: string;
    title: string;
    task_type: string;
    criticality: string;
    classification1?: string;
    classification2?: string;
    estimated_duration_minutes: number;
    planned_downtime_minutes?: number;
    frequency: string;
    frequency_days: number;
    subtasks: any[]; 
}

export interface PlantMaintenancePlan {
    id: string;
    plantId: string;
    asset_category: string;
    title: string;
    task_type: string;
    criticality: string;
    classification1?: string;
    classification2?: string;
    estimated_duration_minutes: number;
    planned_downtime_minutes?: number;
    frequency_days: number;
    active: boolean;
    subtasks: any[];
}