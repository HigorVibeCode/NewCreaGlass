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

// Image attached to an inventory item (e.g. Supplies). One can be marked as main (shown on card).
export interface InventoryItemImage {
  id: string;
  itemId: string;
  storagePath: string;
  sortOrder: number;
  isMain: boolean;
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
  supplier?: string; // '3S' or 'Crea Glass'
  referenceNumber?: string;
  // Supplies-specific (aluminum/rubber profiles)
  position?: string;
  color?: string;
  type?: string;
  opoOeschgerCode?: string;
  /** Fetched separately; main image is the one with isMain true (or first). */
  images?: InventoryItemImage[];
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

// Push Notification types
export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceToken {
  id: string;
  userId: string;
  platform: DevicePlatform;
  token: string;
  deviceId?: string;
  appVersion?: string;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  pushEnabled: boolean;
  workOrdersEnabled: boolean;
  inventoryEnabled: boolean;
  trainingEnabled: boolean;
  bloodPriorityEnabled: boolean;
  productionEnabled: boolean;
  eventsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PushDeliveryStatus = 'queued' | 'sent' | 'failed' | 'delivered';

export interface PushDeliveryLog {
  id: string;
  notificationId: string;
  userId: string;
  deviceTokenId?: string;
  token: string;
  status: PushDeliveryStatus;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
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
  | 'on_paint_cabin'
  | 'on_laminating_machine'
  | 'on_schmelz_oven'
  | 'waiting_for_tempering'
  | 'waiting_for_schmelz'
  | 'tempering_in_progress'
  | 'tempered'
  | 'waiting_for_packing'
  | 'packed'
  | 'ready_for_dispatch'
  | 'delivered'
  | 'completed'
  // Status antigos mantidos para compatibilidade com dados existentes
  | 'on_cabin'
  | 'laminating'
  | 'laminated'
  | 'on_oven';
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

export type ProductionCompany = '3S' | 'Crea Glass';

export interface Production {
  id: string;
  clientName: string;
  orderNumber: string;
  orderType: string;
  dueDate: string;
  status: ProductionStatus;
  items: ProductionItem[];
  attachments: ProductionAttachment[];
  company?: ProductionCompany;
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

// Training types
export type TrainingCategory = 'mandatory' | 'professional' | 'onboarding';

export interface Training {
  id: string;
  title: string;
  description?: string;
  category: TrainingCategory;
  content?: string;
  durationMinutes?: number;
  isActive: boolean;
  attachments?: TrainingAttachment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCompletion {
  id: string;
  trainingId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  timeSpentSeconds: number;
  createdAt: string;
}

export interface TrainingSignature {
  id: string;
  trainingCompletionId: string;
  signaturePath: string;
  fullName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  createdBy: string;
  createdAt: string;
}

export interface TrainingAttachment {
  id: string;
  trainingId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

export interface TrainingWithCompletion extends Training {
  completion?: TrainingCompletion;
  signature?: TrainingSignature;
  attachments?: TrainingAttachment[];
}

// Manuals (Equipment & Tools - Manuais)
export interface ManualAttachment {
  id: string;
  manualId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

export interface Manual {
  id: string;
  title: string;
  attachments?: ManualAttachment[];
  createdAt: string;
}
