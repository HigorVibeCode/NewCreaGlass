import {
  User,
  Permission,
  Session,
  Document,
  InventoryGroup,
  InventoryItem,
  InventoryHistory,
  Notification,
  BloodPriorityMessage,
  BloodPriorityRead,
  Event,
  Production,
  ProductionStatus,
  ProductionStatusHistory,
  WorkOrder,
  WorkOrderStatus,
  CheckIn,
  TimeStatus,
  ServiceLog,
  Evidence,
  ChecklistItem,
  Signature,
} from '../../types';

// Auth Repository
export interface AuthRepository {
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<Session | null>;
  validateSession(session: Session): Promise<boolean>;
}

// Users Repository
export interface UsersRepository {
  getAllUsers(): Promise<User[]>;
  getUserById(userId: string): Promise<User | null>;
  createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  activateUser(userId: string): Promise<void>;
  deactivateUser(userId: string): Promise<void>;
  changeUserPassword(userId: string, newPassword: string): Promise<void>;
}

// Permissions Repository
export interface PermissionsRepository {
  getAllPermissions(): Promise<Permission[]>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  assignPermission(userId: string, permissionId: string): Promise<void>;
  revokePermission(userId: string, permissionId: string): Promise<void>;
  createPermission(permission: Omit<Permission, 'id' | 'createdAt'>): Promise<Permission>;
}

// Documents Repository
export interface DocumentsRepository {
  getAllDocuments(): Promise<Document[]>;
  getDocumentById(documentId: string): Promise<Document | null>;
  uploadDocument(file: File | { uri: string; name: string; type: string }, userId: string): Promise<Document>;
  getDocumentUrl(documentId: string): Promise<string>;
  deleteDocument(documentId: string): Promise<void>;
}

// Inventory Repository
export interface InventoryRepository {
  getAllGroups(): Promise<InventoryGroup[]>;
  createGroup(group: Omit<InventoryGroup, 'id' | 'createdAt'>): Promise<InventoryGroup>;
  getGroupById(groupId: string): Promise<InventoryGroup | null>;
  
  getItemsByGroup(groupId: string): Promise<InventoryItem[]>;
  getAllItems(): Promise<InventoryItem[]>;
  getItemById(itemId: string): Promise<InventoryItem | null>;
  createItem(item: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem>;
  updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteItem(itemId: string): Promise<void>;
  adjustStock(itemId: string, delta: number, userId: string): Promise<InventoryItem>;
  
  getItemHistory(itemId: string): Promise<InventoryHistory[]>;
}

// Notifications Repository
export interface NotificationsRepository {
  getUserNotifications(userId: string): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  clearUserNotifications(userId: string): Promise<void>;
}

// Blood Priority Repository
export interface BloodPriorityRepository {
  getAllMessages(): Promise<BloodPriorityMessage[]>;
  getMessageById(messageId: string): Promise<BloodPriorityMessage | null>;
  createMessage(message: Omit<BloodPriorityMessage, 'id' | 'createdAt'>): Promise<BloodPriorityMessage>;
  getUserReads(userId: string): Promise<BloodPriorityRead[]>;
  getUnreadMessages(userId: string): Promise<BloodPriorityMessage[]>;
  openMessage(messageId: string, userId: string): Promise<BloodPriorityRead>;
  confirmRead(messageId: string, userId: string): Promise<void>;
}

// Events Repository
export interface EventsRepository {
  getAllEvents(): Promise<Event[]>;
  getEventById(eventId: string): Promise<Event | null>;
  createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event>;
  deleteEvent(eventId: string): Promise<void>;
}

// Production Repository
export interface ProductionRepository {
  getAllProductions(status?: ProductionStatus): Promise<Production[]>;
  getProductionById(productionId: string): Promise<Production | null>;
  createProduction(production: Omit<Production, 'id' | 'createdAt'>): Promise<Production>;
  updateProduction(productionId: string, updates: Partial<Production>, changedBy?: string): Promise<Production>;
  deleteProduction(productionId: string): Promise<void>;
  getStatusHistory(productionId: string): Promise<ProductionStatusHistory[]>;
}

// Work Orders Repository
export interface WorkOrdersRepository {
  getAllWorkOrders(status?: WorkOrderStatus): Promise<WorkOrder[]>;
  getWorkOrderById(workOrderId: string): Promise<WorkOrder | null>;
  createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkOrder>;
  updateWorkOrder(workOrderId: string, updates: Partial<WorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(workOrderId: string): Promise<void>;
  
  // Check-in
  createCheckIn(workOrderId: string, checkIn: Omit<CheckIn, 'id' | 'workOrderId' | 'createdAt'>): Promise<CheckIn>;
  getCheckIn(workOrderId: string): Promise<CheckIn | null>;
  
  // Time Status
  createTimeStatus(workOrderId: string, timeStatus: Omit<TimeStatus, 'id' | 'workOrderId' | 'createdAt'>): Promise<TimeStatus>;
  updateTimeStatus(timeStatusId: string, updates: Partial<TimeStatus>): Promise<TimeStatus>;
  getTimeStatuses(workOrderId: string): Promise<TimeStatus[]>;
  getCurrentTimeStatus(workOrderId: string): Promise<TimeStatus | null>;
  
  // Service Logs
  createServiceLog(workOrderId: string, log: Omit<ServiceLog, 'id' | 'workOrderId' | 'createdAt'>): Promise<ServiceLog>;
  getServiceLogs(workOrderId: string): Promise<ServiceLog[]>;
  
  // Evidences
  createEvidence(workOrderId: string, evidence: Omit<Evidence, 'id' | 'workOrderId' | 'createdAt'>): Promise<Evidence>;
  getEvidences(workOrderId: string): Promise<Evidence[]>;
  
  // Checklist Items
  createChecklistItem(workOrderId: string, item: Omit<ChecklistItem, 'id' | 'workOrderId' | 'createdAt'>): Promise<ChecklistItem>;
  updateChecklistItem(itemId: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem>;
  getChecklistItems(workOrderId: string): Promise<ChecklistItem[]>;
  
  // Signature
  createSignature(workOrderId: string, signature: Omit<Signature, 'id' | 'workOrderId' | 'createdAt'>): Promise<Signature>;
  getSignature(workOrderId: string): Promise<Signature | null>;
  
  // Finalization
  finalizeWorkOrder(workOrderId: string): Promise<WorkOrder>;
}
