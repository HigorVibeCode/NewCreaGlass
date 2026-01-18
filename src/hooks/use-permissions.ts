import { useMemo } from 'react';
import { useAuth } from '../store/auth-store';
import { PermissionKey, can } from '../utils/permissions';
import { usePermissionsQuery } from '../services/queries';

export const usePermissions = () => {
  const { user } = useAuth();
  const { data: permissions = [] } = usePermissionsQuery(user?.id);
  
  const hasPermission = (permissionKey: PermissionKey): boolean => {
    // Always return false if no user
    if (!user) return false;
    
    // Master user has ALL permissions - check this FIRST before anything else
    if (user.userType === 'Master') {
      return true;
    }
    
    // For non-Master users, check permissions
    return can(user, permissionKey, permissions);
  };
  
  const permissionsList = useMemo(() => {
    // Master users have all permissions implicitly
    if (user?.userType === 'Master') {
      // Return all possible permission keys for Master
      return [
        'documents.upload',
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
