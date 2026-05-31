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
  const { hasPermission } = usePermissions();
  
  if (user?.userType === 'Master') {
    return <>{children}</>;
  }
  
  if (!user || !hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};
