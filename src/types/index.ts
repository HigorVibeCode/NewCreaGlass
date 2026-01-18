// Core types

export type UserType = 'Master' | 'Manager' | 'Viewer' | 'Onboarding';

export interface User {
  id: string;
  username: string;
  userType: UserType;
  isActive: boolean;
  createdAt: string;
}

export interface Permission {
  id: string;
  key: string;
  descriptionI18nKey: string;
  createdAt: string;
}

export interface UserPermission {
  userId: string;
  permissionId: string;
}

export interface Session {
  user: User;
  token?: string;
}

// Document types
export interface Document {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  createdBy: string;
  createdAt: string;
}

// Inventory types
export interface InventoryGroup {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  groupId: string;
  name: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  createdBy: string;
  createdAt: string;
  // Glass-specific fields (optional for other groups)
  height?: number;
  width?: number;
  thickness?: number;
  totalM2?: number;
  idealStock?: number;
  location?: string;
}

export interface InventoryHistory {
  id: string;
  itemId: string;
  action: string;
  delta: number;
  previousValue: number;
  newValue: number;
  createdBy: string;
  createdAt: string;
}

// Notification types
export interface Notification {
  id: string;
  type: string;
  payloadJson: Record<string, any>;
  createdAt: string;
  createdBySystem: boolean;
  targetUserId?: string;
  readAt?: string;
}

// Blood Priority types
export interface BloodPriorityMessage {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export interface BloodPriorityRead {
  messageId: string;
  userId: string;
  confirmedAt?: string;
  openedAt?: string;
  minTimerSeconds: number;
}

// Event types
export type EventType = 'meeting' | 'training' | 'maintenance' | 'installation' | 'inspection' | 'other';

export interface EventAttachment {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  people: string; // Text field for people names
  attachments: EventAttachment[];
  description?: string;
  createdAt: string;
  createdBy: string;
}

// Production types
export type ProductionStatus = 
  | 'not_authorized'
  | 'authorized'
  | 'cutting'
  | 'polishing'
  | 'waiting_for_tempering'
  | 'on_oven'
  | 'tempered'
  | 'on_cabin'
  | 'laminating'
  | 'laminated'
  | 'waiting_for_packing'
  | 'packed'
  | 'ready_for_dispatch'
  | 'delivered'
  | 'completed';
export type OrderType = 'standard' | 'urgent' | 'custom';
export type GlassType = 'tempered' | 'strengthened' | 'float' | 'laminated' | 'textured' | 'sandblasted' | 'cuted' | 'insulated';
export type StructureType = 'none' | 'linear' | 'abstract' | 'organic' | 'check_project';
export type PaintType = 'none' | 'solid' | 'gradient' | 'printed' | 'satiniert' | 'check_project';

export interface ProductionAttachment {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

export interface ProductionItem {
  id: string;
  glassId: string; // InventoryItem ID
  glassType: GlassType;
  quantity: number;
  areaM2: number;
  structureType: StructureType;
  paintType: PaintType;
}

export interface ProductionStatusHistory {
  id: string;
  productionId: string;
  previousStatus: ProductionStatus;
  newStatus: ProductionStatus;
  changedBy: string;
  changedAt: string;
}

export interface Production {
  id: string;
  clientName: string;
  orderNumber: string;
  orderType: string;
  dueDate: string;
  status: ProductionStatus;
  items: ProductionItem[];
  attachments: ProductionAttachment[];
  createdAt: string;
  createdBy: string;
}

// Work Order / Service Order types
export type WorkOrderServiceType = 'maintenance' | 'installation' | 'internal' | 'external';
export type WorkOrderStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type TimeStatusType = 'EM_ATENDIMENTO' | 'PAUSADO' | 'DESLOCAMENTO';
export type ServiceLogType = 'ajuste' | 'problema' | 'material' | 'recomendacao';
export type EvidenceType = 'antes' | 'durante' | 'depois';
export type ChecklistItemType = 'planned' | 'execution';

export interface WorkOrderChecklistItem {
  id: string;
  title: string;
  description?: string;
  checked: boolean;
}

export interface WorkOrderPlannedMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface CheckIn {
  id: string;
  workOrderId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  toleranceRadius: number; // in meters
  photoPath?: string;
  performedBy: string;
  createdAt: string;
}

export interface TimeStatus {
  id: string;
  workOrderId: string;
  status: TimeStatusType;
  pauseReason?: string; // Required if status is PAUSADO
  startTime: string;
  endTime?: string;
  totalDuration: number; // in seconds
  createdBy: string;
  createdAt: string;
}

export interface ServiceLog {
  id: string;
  workOrderId: string;
  type: ServiceLogType;
  text: string;
  author: string;
  timestamp: string;
  photoPath?: string;
  videoPath?: string;
  createdAt: string;
}

export interface Evidence {
  id: string;
  workOrderId: string;
  type: EvidenceType;
  photoPath: string;
  videoPath?: string;
  internalNotes?: string;
  clientNotes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  workOrderId: string;
  type: ChecklistItemType;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
}

export interface Signature {
  id: string;
  workOrderId: string;
  signaturePath: string; // Storage path to signature image
  fullName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  pinHash?: string; // Hashed PIN if PIN was used
  createdBy: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  clientName: string;
  clientAddress: string;
  clientContact: string;
  serviceType: WorkOrderServiceType;
  scheduledDate: string;
  scheduledTime: string;
  status: WorkOrderStatus;
  plannedChecklist: WorkOrderChecklistItem[]; // JSON array
  plannedMaterials: WorkOrderPlannedMaterial[]; // JSON array
  internalNotes?: string;
  teamMembers: string[]; // Array of user IDs
  responsible: string; // User ID
  isLocked: boolean; // Locked after finalization
  checkIn?: CheckIn;
  timeStatuses: TimeStatus[];
  serviceLogs: ServiceLog[];
  evidences: Evidence[];
  checklistItems: ChecklistItem[];
  signature?: Signature;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}
