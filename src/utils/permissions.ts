import { User, Permission } from '../types';

export type PermissionKey =
  | 'documents.upload'
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
  | 'events.report.create';

export interface PermissionService {
  getUserPermissions(userId: string): Promise<PermissionKey[]>;
  hasPermission(userId: string, permissionKey: PermissionKey): Promise<boolean>;
  getUserPermissionKeys(user: User, userPermissions: Permission[]): PermissionKey[];
}

export const can = (
  user: User | null,
  permissionKey: PermissionKey,
  userPermissions: Permission[] = []
): boolean => {
  if (!user || !user.isActive) {
    return false;
  }
  
  // Master user has all permissions (hardcoded rule)
  if (user.userType === 'Master') {
    return true;
  }
  
  // Check if user has the specific permission
  const permissionKeys = userPermissions.map(p => p.key as PermissionKey);
  return permissionKeys.includes(permissionKey);
};
