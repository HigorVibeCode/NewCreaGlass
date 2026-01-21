import {
    BloodPriorityMessage,
    BloodPriorityRead,
    Document,
    Event,
    InventoryGroup,
    InventoryHistory,
    InventoryItem,
    MaintenanceHistory,
    MaintenanceInfo,
    MaintenanceInfoImage,
    MaintenanceRecord,
    Notification,
    Permission,
    Production,
    ProductionStatus,
    ProductionStatusHistory,
    Session,
    User,
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

// Events Repository (placeholder)
export interface EventsRepository {
  getAllEvents(): Promise<Event[]>;
  getEventById(eventId: string): Promise<Event | null>;
  createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event>;
  updateEvent(eventId: string, updates: Partial<Event>): Promise<Event>;
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

// Maintenance Repository
export interface MaintenanceRepository {
  getAllMaintenanceRecords(): Promise<MaintenanceRecord[]>;
  getMaintenanceRecordById(recordId: string): Promise<MaintenanceRecord | null>;
  createMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'infos' | 'history'>): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(recordId: string, updates: Partial<MaintenanceRecord>, changedBy?: string): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord(recordId: string): Promise<void>;
  addMaintenanceInfo(recordId: string, info: Omit<MaintenanceInfo, 'id' | 'createdAt' | 'updatedAt' | 'images'>): Promise<MaintenanceInfo>;
  updateMaintenanceInfo(infoId: string, updates: Partial<MaintenanceInfo>, changedBy?: string): Promise<MaintenanceInfo>;
  deleteMaintenanceInfo(infoId: string, changedBy?: string): Promise<void>;
  addMaintenanceInfoImage(infoId: string, image: Omit<MaintenanceInfoImage, 'id' | 'createdAt'>): Promise<MaintenanceInfoImage>;
  deleteMaintenanceInfoImage(imageId: string, changedBy?: string): Promise<void>;
  getMaintenanceHistory(recordId: string): Promise<MaintenanceHistory[]>;
}
