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

// Event types (placeholder)
export interface Event {
  id: string;
  title: string;
  description: string;
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

// Maintenance types
export interface MaintenanceInfoImage {
  id: string;
  maintenanceInfoId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  orderIndex: number;
  createdAt: string;
}

export interface MaintenanceInfo {
  id: string;
  maintenanceRecordId: string;
  description: string;
  orderIndex: number;
  images: MaintenanceInfoImage[];
  createdAt: string;
  updatedAt: string;
}

export type MaintenanceHistoryChangeType = 
  | 'created' 
  | 'updated' 
  | 'info_added' 
  | 'info_updated' 
  | 'info_deleted' 
  | 'image_added' 
  | 'image_deleted';

export interface MaintenanceHistory {
  id: string;
  maintenanceRecordId: string;
  changedBy: string;
  changeType: MaintenanceHistoryChangeType;
  changeDescription?: string;
  changedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  title: string;
  equipment: string;
  type: string;
  infos: MaintenanceInfo[];
  history: MaintenanceHistory[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
