// Core types

export type UserType = 'Master' | 'Manager' | 'Viewer' | 'Onboarding';

export interface User {
  id: string;
  username: string;
  userType: UserType;
  isActive: boolean;
  preferredLanguage?: string;
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

// Client types
export interface Client {
  id: string;
  name: string;
  address?: string;
  contact?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
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
  supplier?: string; // '3S', 'Crea Glass' or 'Kromatix'
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
export type EventStatus = 'active' | 'completed';

export interface Event {
  id: string;
  title: string;
  description: string;
  status?: EventStatus;
  createdAt: string;
  createdBy: string;
}

// Production types
export type ProductionStatus = 
  // Red group
  | 'not_authorized'
  | 'cancelled'
  | 'rework_needed'
  // Green (entry)
  | 'authorized'
  // Orange group (active processes)
  | 'on_cutting_process'
  | 'on_polishing_process'
  | 'on_paint_cabin'
  | 'on_laminating_machine'
  | 'on_schmelz_oven'
  | 'on_banding_oven'
  | 'tempering_in_progress'
  // Yellow group (waiting)
  | 'waiting_to_cnc_wjet'
  | 'waiting_to_drill'
  | 'waiting_to_paint_cabin'
  | 'waiting_for_schmelz'
  | 'waiting_for_tempering'
  | 'waiting_for_packing'
  // Blue group
  | 'packed'
  | 'ready_for_dispatch'
  // Green (exit)
  | 'delivered'
  | 'completed'
  // Status antigos mantidos para compatibilidade com dados existentes
  | 'cutting'
  | 'polishing'
  | 'tempered'
  | 'on_cabin'
  | 'laminating'
  | 'laminated'
  | 'on_oven'
  | 'on_oven';
export type OrderType = 'standard' | 'urgent' | 'custom';
export type GlassType = 'tempered' | 'strengthened' | 'float' | 'laminated' | 'textured' | 'sandblasted' | 'cuted' | 'insulated' | 'lavabo' | 'client_service' | 'polish_only' | 'cutting_only' | 'schmelzglas_only' | 'float_esg' | 'schmelzglas_tvg' | 'float_tvg';
export type StructureType = 'none' | 'linear' | 'abstract' | 'organic' | 'check_project';
export type PaintType = 'none' | 'solid' | 'gradient' | 'printed' | 'satiniert' | 'check_project';

export interface ProductionAttachment {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  /** Raw storage key from DB — kept intact across load/save cycles so signed URLs never overwrite the real key */
  originalStoragePath?: string;
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
  clientId?: string;
  clientName: string;
  orderNumber: string;
  orderType: string;
  dueDate: string;
  status: ProductionStatus;
  items: ProductionItem[];
  attachments: ProductionAttachment[];
  linkedWorkOrderId?: string;
  company?: ProductionCompany;
  createdAt: string;
  createdBy: string;
}

// Work Orders types
export type WorkOrderStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type WorkOrderServiceType = 'maintenance' | 'installation' | 'internal' | 'external';
export type TimeStatusType = 'EM_ATENDIMENTO' | 'PAUSADO' | 'DESLOCAMENTO';
export type EvidenceType = 'antes' | 'durante' | 'depois';
export type ServiceLogType = 'ajuste' | 'problema' | 'material' | 'recomendacao';
export type ChecklistItemType = 'planned' | 'execution';

export interface WorkOrderChecklistPlanItem {
  id: string;
  title: string;
  description?: string;
  checked?: boolean;
}

export interface WorkOrderPlannedMaterial {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
}

export interface CheckIn {
  id: string;
  workOrderId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  toleranceRadius: number;
  photoPath?: string;
  performedBy: string;
  createdAt: string;
}

export interface TimeStatus {
  id: string;
  workOrderId: string;
  status: TimeStatusType;
  pauseReason?: string;
  startTime: string;
  endTime?: string;
  totalDuration: number;
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
  signaturePath: string;
  fullName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  pinHash?: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  clientId?: string;
  clientName: string;
  clientAddress: string;
  clientContact: string;
  serviceType: WorkOrderServiceType;
  scheduledDate: string;
  scheduledTime: string;
  status: WorkOrderStatus;
  plannedChecklist: WorkOrderChecklistPlanItem[];
  plannedMaterials: WorkOrderPlannedMaterial[];
  internalNotes?: string;
  teamMembers: string[];
  responsible: string;
  isLocked: boolean;
  productionOrderId?: string;
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
  /** Storage path or signed URL for the Basic Information card cover image */
  coverImagePath?: string;
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
  /** Traduções do título por locale (ex: { en: "...", es: "..." }). Usado em onboarding. */
  titleI18n?: Record<string, string> | null;
  /** Traduções da descrição por locale. Usado em onboarding. */
  descriptionI18n?: Record<string, string> | null;
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
  thumbnailPath?: string | null;
  attachments?: ManualAttachment[];
  createdAt: string;
}

// Equipment Documents (Central de Documentos de Máquinas)
export interface EquipmentMachine {
  id: string;
  name: string;
  icon?: string;
  createdBy: string;
  createdAt: string;
}

export interface EquipmentDocumentAttachment {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

export interface EquipmentDocument {
  id: string;
  equipmentId: string;
  title: string;
  description?: string;
  thumbnailPath?: string | null;
  attachments?: EquipmentDocumentAttachment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Time entries (Controle de Ponto)
export type GpsSource = 'gps' | 'network';
export type EntryType = 'clock_in' | 'clock_out' | 'coffee_start' | 'coffee_end' | 'lunch_start' | 'lunch_end';

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  recordedAt: string;
  entryType?: EntryType | null;
  locationAddress: string | null;
  gpsAccuracy: number | null;
  gpsSource: GpsSource | null;
  createdAt: string;
  isAdjusted: boolean;
  adjustedRecordedAt: string | null;
  adjustDescription: string | null;
  adjustedAt: string | null;
  adjustedByUserId: string | null;
}
