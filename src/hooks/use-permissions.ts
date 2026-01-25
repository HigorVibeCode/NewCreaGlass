import { useMemo } from 'react';
import { useAuth } from '../store/auth-store';
import { PermissionKey, can } from '../utils/permissions';
import { usePermissionsQuery } from '../services/queries';

export const usePermissions = () => {
  const { user } = useAuth();
  const { data: permissions = [] } = usePermissionsQuery(user?.id);
  
  const hasPermission = (permissionKey: PermissionKey): boolean => {
    // Always return false if no user
    if (!user) {
      return false;
    }
    
    // Master user has ALL permissions - check this FIRST before anything else
    if (user.userType === 'Master') {
      return true;
    }
    
    // For non-Master users, check permissions from the database
    const result = can(user, permissionKey, permissions);
    
    // Debug log (can be removed later)
    if (__DEV__) {
      console.log(`[Permission Check] User: ${user.username}, Permission: ${permissionKey}, Has: ${result}, Total permissions: ${permissions.length}`);
    }
    
    return result;
  };
  
  const permissionsList = useMemo(() => {
    // Master users have all permissions implicitly
    if (user?.userType === 'Master') {
      // Return all possible permission keys for Master
      return [
        'documents.upload',
        'documents.create',
        'documents.view',
        'documents.download',
        'documents.delete',
        'inventory.create',
        'inventory.update',
        'inventory.delete',
        'inventory.group.create',
        'inventory.item.create',
        'inventory.item.update',
        'inventory.item.delete',
        'inventory.item.adjustStock',
        'inventory.viewHistory',
        'notifications.view',
        'bloodPriority.view',
        'bloodPriority.confirmRead',
        'bloodPriority.create',
        'accessControls.view',
        'accessControls.manageUsers',
        'accessControls.managePermissions',
        'users.activateDeactivate',
        'users.create',
        'qr.scan',
        'nfc.read',
        'production.create',
        'production.update',
        'production.delete',
        'events.view',
        'events.create',
        'events.update',
        'events.delete',
        'events.history',
        'events.report.create',
        'workOrders.create',
        'workOrders.view',
        'workOrders.update',
        'workOrders.delete',
      ] as PermissionKey[];
    }
    return permissions.map(p => p.key as PermissionKey);
  }, [permissions, user?.userType]);
  
  return {
    hasPermission,
    permissions: permissionsList,
    isLoading: !user, // Don't wait for permissions query for Master users
  };
};
