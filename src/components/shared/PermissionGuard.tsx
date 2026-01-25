import React from 'react';
import { useAuth } from '../../store/auth-store';
import { PermissionKey } from '../../utils/permissions';
import { usePermissions } from '../../hooks/use-permissions';

interface PermissionGuardProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { user } = useAuth();
  const { hasPermission, isLoading } = usePermissions();
  
  // Master users always have access - check this first
  if (user?.userType === 'Master') {
    if (__DEV__) {
      console.log(`[PermissionGuard] Master user - allowing access to: ${permission}`);
    }
    return <>{children}</>;
  }
  
  // Check permission for non-Master users
  const userHasPermission = hasPermission(permission);
  
  if (__DEV__) {
    console.log(`[PermissionGuard] User: ${user?.username}, Permission: ${permission}, Has: ${userHasPermission}, Loading: ${isLoading}`);
  }
  
  if (!user || !userHasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};
