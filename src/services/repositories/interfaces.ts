import {
    BloodPriorityMessage,
    BloodPriorityRead,
    MailboxRow,
    UserDirectMessage,
    UserDirectMessageDetail,
    CheckIn,
    ChecklistItem,
    Client,
    DeviceToken,
    Document,
    EquipmentDocument,
    EquipmentDocumentAttachment,
    EquipmentMachine,
    Evidence,
    Event,
    InventoryGroup,
    InventoryHistory,
    InventoryItem,
    InventoryItemImage,
    MaintenanceHistory,
    MaintenanceInfo,
    MaintenanceInfoImage,
    MaintenanceRecord,
    Notification,
    NotificationPreferences,
    Permission,
    Production,
    ProductionStatus,
    ProductionStatusHistory,
    PushDeliveryLog,
    ServiceLog,
    Session,
    Signature,
    TimeStatus,
    TimeEntry,
    Training,
    TrainingCategory,
    TrainingCompletion,
    TrainingWithCompletion,
    User,
    WorkOrder,
    WorkOrderStatus,
    Manual,
    ManualAttachment,
} from '../../types';

// Auth Repository
export interface AuthRepository {
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<Session | null>;
  validateSession(session: Session): Promise<boolean>;
  /** Valida senha do usuário atual (para confirmação ex.: registro de ponto). */
  validatePassword(password: string): Promise<boolean>;
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
  updatePreferredLanguage(userId: string, language: string): Promise<void>;
}

// Clients Repository
export interface ClientsRepository {
  getAllClients(search?: string): Promise<Client[]>;
  getClientById(clientId: string): Promise<Client | null>;
  createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client>;
  updateClient(clientId: string, updates: Partial<Client>): Promise<Client>;
  deleteClient(clientId: string): Promise<void>;
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
  getItemsByIds(ids: string[]): Promise<InventoryItem[]>;
  createItem(item: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem>;
  updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteItem(itemId: string): Promise<void>;
  adjustStock(itemId: string, delta: number, userId: string): Promise<InventoryItem>;
  
  getItemHistory(itemId: string): Promise<InventoryHistory[]>;

  /** Up to 3 images per item; one can be main (shown on card). */
  addItemImage(itemId: string, file: { uri: string; name: string; type: string }, isMain?: boolean): Promise<InventoryItemImage>;
  deleteItemImage(imageId: string): Promise<void>;
  setMainItemImage(imageId: string): Promise<void>;
  getItemImageUrlSigned(storagePath: string): Promise<string>;
  prefetchItemImageUrls(storagePaths: string[]): Promise<void>;
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
  deleteMessage(messageId: string): Promise<void>;
  getUserReads(userId: string): Promise<BloodPriorityRead[]>;
  getUnreadMessages(userId: string): Promise<BloodPriorityMessage[]>;
  openMessage(messageId: string, userId: string): Promise<BloodPriorityRead>;
  confirmRead(messageId: string, userId: string): Promise<void>;
}

/** Mensagens entre utilizadores, estilo email (uma mensagem = um registo; sem chat). */
export interface DirectMessagesRepository {
  getUnreadCount(): Promise<number>;
  getReceivedMessages(): Promise<MailboxRow[]>;
  getSentMessages(): Promise<MailboxRow[]>;
  sendMessage(recipientId: string, body: string): Promise<UserDirectMessage>;
  getMessageById(messageId: string): Promise<UserDirectMessageDetail | null>;
  markMessageRead(messageId: string): Promise<void>;
}

// Events Repository (placeholder)
export interface EventsRepository {
  getAllEvents(): Promise<Event[]>;
  getEventById(eventId: string): Promise<Event | null>;
  createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event>;
  updateEvent(eventId: string, updates: Partial<Event>): Promise<Event>;
}

// Work Orders Repository
export interface WorkOrdersRepository {
  getAllWorkOrders(status?: WorkOrderStatus): Promise<WorkOrder[]>;
  getWorkOrderById(workOrderId: string): Promise<WorkOrder | null>;
  createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkOrder>;
  updateWorkOrder(workOrderId: string, updates: Partial<WorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(workOrderId: string): Promise<void>;

  createCheckIn(workOrderId: string, checkIn: Omit<CheckIn, 'id' | 'workOrderId' | 'createdAt'>): Promise<CheckIn>;
  getCheckIn(workOrderId: string): Promise<CheckIn | null>;
  createTimeStatus(workOrderId: string, timeStatus: Omit<TimeStatus, 'id' | 'workOrderId' | 'createdAt'>): Promise<TimeStatus>;
  updateTimeStatus(timeStatusId: string, updates: Partial<TimeStatus>): Promise<TimeStatus>;
  getTimeStatuses(workOrderId: string): Promise<TimeStatus[]>;
  getCurrentTimeStatus(workOrderId: string): Promise<TimeStatus | null>;
  createServiceLog(workOrderId: string, log: Omit<ServiceLog, 'id' | 'workOrderId' | 'createdAt'>): Promise<ServiceLog>;
  getServiceLogs(workOrderId: string): Promise<ServiceLog[]>;
  createEvidence(workOrderId: string, evidence: Omit<Evidence, 'id' | 'workOrderId' | 'createdAt'>): Promise<Evidence>;
  getEvidences(workOrderId: string): Promise<Evidence[]>;
  createChecklistItem(workOrderId: string, item: Omit<ChecklistItem, 'id' | 'workOrderId' | 'createdAt'>): Promise<ChecklistItem>;
  updateChecklistItem(itemId: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem>;
  getChecklistItems(workOrderId: string): Promise<ChecklistItem[]>;
  createSignature(workOrderId: string, signature: Omit<Signature, 'id' | 'workOrderId' | 'createdAt'>): Promise<Signature>;
  getSignature(workOrderId: string): Promise<Signature | null>;
  finalizeWorkOrder(workOrderId: string): Promise<WorkOrder>;
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
  /** Upload a cover image to storage; returns the storage path (filename) to store in cover_image_path */
  uploadCoverImage(file: { uri: string; name: string; type: string }): Promise<string>;
  addMaintenanceInfo(recordId: string, info: Omit<MaintenanceInfo, 'id' | 'createdAt' | 'updatedAt' | 'images'>): Promise<MaintenanceInfo>;
  updateMaintenanceInfo(infoId: string, updates: Partial<MaintenanceInfo>, changedBy?: string): Promise<MaintenanceInfo>;
  deleteMaintenanceInfo(infoId: string, changedBy?: string): Promise<void>;
  addMaintenanceInfoImage(infoId: string, image: Omit<MaintenanceInfoImage, 'id' | 'createdAt'>): Promise<MaintenanceInfoImage>;
  deleteMaintenanceInfoImage(imageId: string, changedBy?: string): Promise<void>;
  getMaintenanceHistory(recordId: string): Promise<MaintenanceHistory[]>;
}

// Training Repository
export interface TrainingRepository {
  getAllTrainings(category?: TrainingCategory): Promise<Training[]>;
  getTrainingById(trainingId: string): Promise<Training | null>;
  createTraining(training: Omit<Training, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>): Promise<Training>;
  updateTraining(trainingId: string, updates: Partial<Training>): Promise<Training>;
  deleteTraining(trainingId: string): Promise<void>;
  
  // Training attachments
  addTrainingAttachment(trainingId: string, file: File | { uri: string; name: string; type: string; webFile?: File }): Promise<import('../../types').TrainingAttachment>;
  deleteTrainingAttachment(attachmentId: string): Promise<void>;
  getTrainingAttachmentUrl(attachmentId: string): Promise<string>;
  
  // Training completions
  startTraining(trainingId: string, userId: string): Promise<TrainingCompletion>;
  updateTrainingTime(trainingId: string, userId: string, timeSpentSeconds: number): Promise<TrainingCompletion>;
  completeTraining(trainingId: string, userId: string, signatureData: string, fullName: string, latitude: number, longitude: number): Promise<TrainingCompletion>;
  getTrainingCompletion(trainingId: string, userId: string): Promise<TrainingCompletion | null>;
  getSignatureByCompletionId(completionId: string): Promise<import('../../types').TrainingSignature | null>;
  
  // History
  restartTraining(trainingId: string, userId: string): Promise<void>;
  getCompletedTrainings(userId?: string): Promise<TrainingWithCompletion[]>; // If userId is provided, get user's completions; if not and user is Master, get all
  getTrainingHistory(trainingId: string, userId?: string): Promise<TrainingWithCompletion[]>; // Get all completions for a specific training
}

// Manuals Repository (Equipment & Tools - Manuais)
export interface ManualsRepository {
  getAllManuals(): Promise<Manual[]>;
  getManualById(manualId: string): Promise<Manual | null>;
  createManual(manual: Omit<Manual, 'id' | 'createdAt' | 'attachments'>): Promise<Manual>;
  updateManual(manualId: string, updates: Partial<Pick<Manual, 'title' | 'thumbnailPath'>>): Promise<Manual>;
  deleteManual(manualId: string): Promise<void>;
  addManualAttachment(manualId: string, file: File | { uri: string; name: string; type: string }): Promise<ManualAttachment>;
  deleteManualAttachment(attachmentId: string): Promise<void>;
  getManualAttachmentUrl(attachmentId: string): Promise<string>;
  uploadManualThumbnail(manualId: string, file: { uri: string; name: string; type: string }): Promise<string>;
  getManualThumbnailUrl(manualId: string): Promise<string>;
}

// Equipment Documents Repository (Central de Documentos de Máquinas)
export interface EquipmentDocumentsRepository {
  // Equipment Machines (folders)
  getAllEquipment(): Promise<EquipmentMachine[]>;
  getEquipmentById(equipmentId: string): Promise<EquipmentMachine | null>;
  createEquipment(equipment: Omit<EquipmentMachine, 'id' | 'createdAt'>): Promise<EquipmentMachine>;
  updateEquipment(equipmentId: string, updates: Partial<Pick<EquipmentMachine, 'name' | 'icon'>>): Promise<EquipmentMachine>;
  deleteEquipment(equipmentId: string): Promise<void>;

  // Equipment Documents (blocks)
  getDocumentsByEquipment(equipmentId: string): Promise<EquipmentDocument[]>;
  getDocumentById(documentId: string): Promise<EquipmentDocument | null>;
  createDocument(doc: Omit<EquipmentDocument, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>): Promise<EquipmentDocument>;
  updateDocument(documentId: string, updates: Partial<Pick<EquipmentDocument, 'title' | 'description' | 'thumbnailPath'>>): Promise<EquipmentDocument>;
  deleteDocument(documentId: string): Promise<void>;

  // Attachments (up to 10 per block)
  addDocumentAttachment(documentId: string, file: File | { uri: string; name: string; type: string }): Promise<EquipmentDocumentAttachment>;
  deleteDocumentAttachment(attachmentId: string): Promise<void>;
  getDocumentAttachmentUrl(attachmentId: string): Promise<string>;

  // Thumbnail
  uploadDocumentThumbnail(documentId: string, file: { uri: string; name: string; type: string }): Promise<string>;
  getDocumentThumbnailUrl(documentId: string): Promise<string>;
}

// Device Tokens Repository
export interface DeviceTokensRepository {
  registerDeviceToken(token: Omit<DeviceToken, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>): Promise<DeviceToken>;
  updateDeviceToken(tokenId: string, updates: Partial<DeviceToken>): Promise<DeviceToken>;
  getDeviceTokensByUserId(userId: string): Promise<DeviceToken[]>;
  getActiveDeviceTokensByUserId(userId: string): Promise<DeviceToken[]>;
  deactivateDeviceToken(tokenId: string): Promise<void>;
  deactivateDeviceTokenByToken(token: string, platform: string): Promise<void>;
  deleteDeviceToken(tokenId: string): Promise<void>;
}

// Notification Preferences Repository
export interface NotificationPreferencesRepository {
  getPreferencesByUserId(userId: string): Promise<NotificationPreferences | null>;
  createPreferences(preferences: Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationPreferences>;
  updatePreferences(userId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
  getOrCreatePreferences(userId: string): Promise<NotificationPreferences>;
}

// Push Delivery Logs Repository
export interface PushDeliveryLogsRepository {
  createLog(log: Omit<PushDeliveryLog, 'id' | 'createdAt'>): Promise<PushDeliveryLog>;
  updateLogStatus(logId: string, status: PushDeliveryLog['status'], errorMessage?: string, deliveredAt?: string): Promise<void>;
  getLogsByNotificationId(notificationId: string): Promise<PushDeliveryLog[]>;
  getLogsByUserId(userId: string, limit?: number): Promise<PushDeliveryLog[]>;
}

// Time Entries Repository (Controle de Ponto)
export interface TimeEntriesRepository {
  createTimeEntry(entry: Omit<TimeEntry, 'id' | 'createdAt'>): Promise<TimeEntry>;
  getMyTimeEntries(userId: string, options?: { from?: string; to?: string }): Promise<TimeEntry[]>;
  getAllTimeEntries(options?: { from?: string; to?: string; userId?: string }): Promise<TimeEntry[]>;
  getServerTime(): Promise<string>;
  updateTimeEntryAdjustment(
    entryId: string,
    payload: { adjustedRecordedAt: string; adjustDescription: string }
  ): Promise<TimeEntry>;
  saveDayTimeAdjustment(payload: {
    userId: string;
    userName: string;
    dateKey: string;
    adjustDescription: string;
    times: {
      clockIn: string;
      clockOut: string;
      coffeeStart: string;
      coffeeEnd: string;
      lunchStart: string;
      lunchEnd: string;
    };
    existingEntries: TimeEntry[];
  }): Promise<void>;
}
