import { User, Permission } from '../types';

export type PermissionKey =
  | 'documents.upload'
  | 'documents.create'
  | 'documents.view'
  | 'documents.download'
  | 'documents.delete'
  | 'inventory.create'
  | 'inventory.update'
  | 'inventory.delete'
  | 'inventory.group.create'
  | 'inventory.item.create'
  | 'inventory.item.update'
  | 'inventory.item.delete'
  | 'inventory.item.adjustStock'
  | 'inventory.viewHistory'
  | 'notifications.view'
  | 'bloodPriority.view'
  | 'bloodPriority.confirmRead'
  | 'bloodPriority.create'
  | 'accessControls.view'
  | 'accessControls.manageUsers'
  | 'accessControls.managePermissions'
  | 'users.activateDeactivate'
  | 'users.create'
  | 'qr.scan'
  | 'nfc.read'
  | 'production.create'
  | 'production.update'
  | 'production.delete'
  | 'events.view'
  | 'events.create'
  | 'events.update'
  | 'events.delete'
  | 'events.history'
  | 'events.report.create'
  | 'workOrders.create'
  | 'workOrders.view'
  | 'workOrders.update'
  | 'workOrders.delete';

export interface PermissionService {
  getUserPermissions(userId: string): Promise<PermissionKey[]>;
  hasPermission(userId: string, permissionKey: PermissionKey): Promise<boolean>;
  getUserPermissionKeys(user: User, userPermissions: Permission[]): PermissionKey[];
}

/**
 * Normalizes permission keys to handle inconsistencies between database (kebab-case) and code (camelCase)
 * Also handles aliases and hierarchical permissions
 * Examples:
 * - "blood-priority.create" -> "bloodPriority.create"
 * - "inventory.update" can be used for "inventory.item.update"
 * - "documents.upload" can be used for "documents.create"
 */
const normalizePermissionKey = (key: string): string => {
  // Convert kebab-case to camelCase for various permissions
  let normalized = key
    .replace(/blood-priority/g, 'bloodPriority')
    .replace(/work-orders/g, 'workOrders')
    .replace(/work-order/g, 'workOrder');
  
  return normalized;
};

/**
 * Checks if a permission key matches, considering hierarchical permissions
 * For example: inventory.update can grant inventory.item.update
 */
const matchesPermission = (
  requestedKey: string,
  availableKey: string
): boolean => {
  // Exact match
  if (requestedKey === availableKey) {
    return true;
  }
  
  // Normalize both keys
  const normalizedRequested = normalizePermissionKey(requestedKey);
  const normalizedAvailable = normalizePermissionKey(availableKey);
  
  // Exact match after normalization
  if (normalizedRequested === normalizedAvailable) {
    return true;
  }
  
  // Hierarchical permissions: inventory.update grants inventory.item.update, inventory.item.adjustStock, etc.
  if (normalizedRequested.startsWith('inventory.item.') && normalizedAvailable === 'inventory.update') {
    return true;
  }
  // inventory.create grants inventory.item.create, inventory.group.create, etc.
  if ((normalizedRequested.startsWith('inventory.item.') || normalizedRequested.startsWith('inventory.group.')) && normalizedAvailable === 'inventory.create') {
    return true;
  }
  
  // Alias: documents.create can use documents.upload (bidirectional)
  if (normalizedRequested === 'documents.create' && normalizedAvailable === 'documents.upload') {
    return true;
  }
  if (normalizedRequested === 'documents.upload' && normalizedAvailable === 'documents.create') {
    return true;
  }
  
  // Alias: events.report.create can use workOrders.create (bidirectional)
  if (normalizedRequested === 'events.report.create' && normalizedAvailable === 'workOrders.create') {
    return true;
  }
  if (normalizedRequested === 'workOrders.create' && normalizedAvailable === 'events.report.create') {
    return true;
  }
  
  // Hierarchical: events.create grants events.report.create (creating work orders is part of events)
  if (normalizedRequested === 'events.report.create' && normalizedAvailable === 'events.create') {
    return true;
  }
  
  return false;
};

export const can = (
  user: User | null,
  permissionKey: PermissionKey,
  userPermissions: Permission[] = []
): boolean => {
  if (!user || !user.isActive) {
    if (__DEV__) {
      console.log(`[can] No user or inactive: user=${!!user}, isActive=${user?.isActive}`);
    }
    return false;
  }
  
  // Master user has all permissions (hardcoded rule)
  if (user.userType === 'Master') {
    return true;
  }
  
  // Check if user has the permission using hierarchical matching
  let hasPermission = false;
  let matchedPermission: string | null = null;
  
  for (const userPerm of userPermissions) {
    if (matchesPermission(permissionKey, userPerm.key)) {
      hasPermission = true;
      matchedPermission = userPerm.key;
      break;
    }
  }
  
  if (__DEV__) {
    const availableKeys = userPermissions.map(p => p.key).join(', ');
    const matchInfo = matchedPermission ? ` (matched with: ${matchedPermission})` : '';
    console.log(`[can] User: ${user.username}, Permission: ${permissionKey}, Available: [${availableKeys}], Has: ${hasPermission}${matchInfo}`);
  }
  
  return hasPermission;
};
