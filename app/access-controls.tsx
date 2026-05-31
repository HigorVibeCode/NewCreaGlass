import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Alert, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { useUsersQuery, useAllPermissionsQuery } from '../src/services/queries';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { repos } from '../src/services/container';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { User, UserType } from '../src/types';
import { confirmDialog } from '../src/utils/confirm-dialog';

type PermissionDef = { key: string; descriptionI18nKey: string };

interface PermissionGroup {
  titleI18nKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  permissions: PermissionDef[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    titleI18nKey: 'permissions._group.production',
    icon: 'construct',
    permissions: [
      { key: 'production.create', descriptionI18nKey: 'permissions.production.create' },
      { key: 'production.update', descriptionI18nKey: 'permissions.production.update' },
      { key: 'production.delete', descriptionI18nKey: 'permissions.production.delete' },
    ],
  },
  {
    titleI18nKey: 'permissions._group.documents',
    icon: 'book',
    permissions: [
      { key: 'documents.view', descriptionI18nKey: 'permissions.documents.view' },
      { key: 'documents.upload', descriptionI18nKey: 'permissions.documents.upload' },
      { key: 'documents.create', descriptionI18nKey: 'permissions.documents.create' },
      { key: 'documents.download', descriptionI18nKey: 'permissions.documents.download' },
      { key: 'documents.update', descriptionI18nKey: 'permissions.documents.update' },
      { key: 'documents.delete', descriptionI18nKey: 'permissions.documents.delete' },
    ],
  },
  {
    titleI18nKey: 'permissions._group.events',
    icon: 'calendar',
    permissions: [
      { key: 'events.view', descriptionI18nKey: 'permissions.events.view' },
      { key: 'events.create', descriptionI18nKey: 'permissions.events.create' },
      { key: 'events.update', descriptionI18nKey: 'permissions.events.update' },
      { key: 'events.delete', descriptionI18nKey: 'permissions.events.delete' },
      { key: 'events.history', descriptionI18nKey: 'permissions.events.history' },
      { key: 'events.report.create', descriptionI18nKey: 'permissions.events.report.create' },
      { key: 'workOrders.view', descriptionI18nKey: 'permissions.workOrders.view' },
      { key: 'workOrders.create', descriptionI18nKey: 'permissions.workOrders.create' },
      { key: 'workOrders.update', descriptionI18nKey: 'permissions.workOrders.update' },
      { key: 'workOrders.delete', descriptionI18nKey: 'permissions.workOrders.delete' },
    ],
  },
  {
    titleI18nKey: 'permissions._group.inventory',
    icon: 'cube',
    permissions: [
      { key: 'inventory.create', descriptionI18nKey: 'permissions.inventory.create' },
      { key: 'inventory.update', descriptionI18nKey: 'permissions.inventory.update' },
      { key: 'inventory.delete', descriptionI18nKey: 'permissions.inventory.delete' },
      { key: 'inventory.group.create', descriptionI18nKey: 'permissions.inventory.group.create' },
      { key: 'inventory.item.create', descriptionI18nKey: 'permissions.inventory.item.create' },
      { key: 'inventory.item.update', descriptionI18nKey: 'permissions.inventory.item.update' },
      { key: 'inventory.item.delete', descriptionI18nKey: 'permissions.inventory.item.delete' },
      { key: 'inventory.item.adjustStock', descriptionI18nKey: 'permissions.inventory.item.adjustStock' },
      { key: 'inventory.viewHistory', descriptionI18nKey: 'permissions.inventory.viewHistory' },
    ],
  },
  {
    titleI18nKey: 'permissions._group.notifications',
    icon: 'notifications',
    permissions: [
      { key: 'notifications.view', descriptionI18nKey: 'permissions.notifications.view' },
      { key: 'bloodPriority.view', descriptionI18nKey: 'permissions.bloodPriority.view' },
      { key: 'bloodPriority.confirmRead', descriptionI18nKey: 'permissions.bloodPriority.confirmRead' },
      { key: 'bloodPriority.create', descriptionI18nKey: 'permissions.bloodPriority.create' },
    ],
  },
  {
    titleI18nKey: 'permissions._group.admin',
    icon: 'shield-checkmark',
    permissions: [
      { key: 'accessControls.view', descriptionI18nKey: 'permissions.accessControls.view' },
      { key: 'accessControls.manageUsers', descriptionI18nKey: 'permissions.accessControls.manageUsers' },
      { key: 'accessControls.managePermissions', descriptionI18nKey: 'permissions.accessControls.managePermissions' },
      { key: 'users.activateDeactivate', descriptionI18nKey: 'permissions.users.activateDeactivate' },
      { key: 'users.create', descriptionI18nKey: 'permissions.users.create' },
    ],
  },
  {
    titleI18nKey: 'permissions._group.devices',
    icon: 'qr-code',
    permissions: [
      { key: 'qr.scan', descriptionI18nKey: 'permissions.qr.scan' },
      { key: 'nfc.read', descriptionI18nKey: 'permissions.nfc.read' },
    ],
  },
];

const REQUIRED_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap(g => g.permissions);

export default function AccessControlsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsersQuery();
  const { data: allPermissions = [], isSuccess: permissionsLoaded } = useAllPermissionsQuery();

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showUserPermissionsModal, setShowUserPermissionsModal] = useState<string | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserType, setNewUserType] = useState<UserType>('Viewer');
  const [changePasswordValue, setChangePasswordValue] = useState('');

  const isMaster = user?.userType === 'Master';
  const permsSyncedRef = useRef(false);

  // Auto-sync: ensure all required permissions exist in the database (runs once per mount)
  useEffect(() => {
    if (!isMaster || permsSyncedRef.current || !permissionsLoaded) return;
    permsSyncedRef.current = true;

    const syncPermissions = async () => {
      const existingKeys = new Set(allPermissions.map(p => p.key));
      const missing = REQUIRED_PERMISSIONS.filter(rp => !existingKeys.has(rp.key));
      if (missing.length === 0) return;
      console.log('[AccessControl] Creating missing permissions:', missing.map(m => m.key));
      for (const perm of missing) {
        try {
          await repos.permissionsRepo.createPermission({
            key: perm.key,
            descriptionI18nKey: perm.descriptionI18nKey,
          });
        } catch (err) {
          console.warn('[AccessControl] Failed to create permission:', perm.key, err);
        }
      }
      // Refresh the permissions list
      queryClient.invalidateQueries({ queryKey: ['allPermissions'] });
    };
    syncPermissions();
  }, [isMaster, allPermissions]);

  const userTypeOptions: DropdownOption[] = [
    { label: 'Manager', value: 'Manager' },
    { label: 'Viewer', value: 'Viewer' },
    { label: 'Onboarding', value: 'Onboarding' },
  ];

  const createUserMutation = useMutation({
    mutationFn: async (userData: { username: string; password: string; userType: UserType }) => {
      // Create user with password (password is stored separately in mock repository)
      const user = await repos.usersRepo.createUser({
        username: userData.username,
        userType: userData.userType,
        isActive: true,
      }, userData.password);
      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateUserModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewUserType('Viewer');
      Alert.alert(t('common.success'), t('accessControls.userCreated'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.message || t('common.error'));
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      if (isActive) {
        await repos.usersRepo.activateUser(userId);
      } else {
        await repos.usersRepo.deactivateUser(userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      await repos.usersRepo.changeUserPassword(userId, newPassword);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowChangePasswordModal(null);
      setChangePasswordValue('');
      Alert.alert(t('common.success'), t('accessControls.passwordChanged'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.message || t('common.error'));
    },
  });

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      Alert.alert(t('common.error'), 'Please fill all fields');
      return;
    }
    createUserMutation.mutate({
      username: newUsername.trim(),
      password: newPassword,
      userType: newUserType,
    });
  };

  const handleToggleUserActive = (userToToggle: User) => {
    if (userToToggle.userType === 'Master') {
      Alert.alert(t('common.error'), t('accessControls.onlyMasterCanManage'));
      return;
    }
    
    const isActivating = !userToToggle.isActive;
    
    if (isActivating) {
      // Ativar usuário - sem confirmação necessária
      toggleUserActiveMutation.mutate({
        userId: userToToggle.id,
        isActive: true,
      });
    } else {
      // Desativar usuário - pedir confirmação
      confirmDialog(
        t('accessControls.deactivateUser'),
        t('accessControls.deactivateUserConfirm', { username: userToToggle.username }),
        () => {
          toggleUserActiveMutation.mutate({
            userId: userToToggle.id,
            isActive: false,
          });
        },
        undefined,
        t('accessControls.deactivate'),
        t('common.cancel')
      );
    }
  };

  const handleChangePassword = () => {
    if (!changePasswordValue.trim()) {
      Alert.alert(t('common.error'), t('accessControls.passwordRequired'));
      return;
    }
    if (!showChangePasswordModal) return;
    changePasswordMutation.mutate({
      userId: showChangePasswordModal,
      newPassword: changePasswordValue,
    });
  };

  const UserPermissionsModal = ({ userId }: { userId: string }) => {
    const selectedUser = users.find(u => u.id === userId);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);

    useEffect(() => {
      const loadPermissions = async () => {
        const perms = await repos.permissionsRepo.getUserPermissions(userId);
        setUserPermissions(perms.map(p => p.id));
      };
      if (userId) loadPermissions();
    }, [userId]);

    const togglePermission = async (permissionId: string) => {
      const hasPermission = userPermissions.includes(permissionId);
      if (hasPermission) {
        await repos.permissionsRepo.revokePermission(userId, permissionId);
      } else {
        await repos.permissionsRepo.assignPermission(userId, permissionId);
      }
      const perms = await repos.permissionsRepo.getUserPermissions(userId);
      setUserPermissions(perms.map(p => p.id));
      queryClient.invalidateQueries({ queryKey: ['permissions', userId] });
    };

    const permsByKey = new Map(allPermissions.map(p => [p.key, p]));

    const assignedCount = REQUIRED_PERMISSIONS.filter(rp => {
      const dbPerm = permsByKey.get(rp.key);
      return dbPerm && userPermissions.includes(dbPerm.id);
    }).length;

    if (!selectedUser) return null;

    return (
      <Modal
        visible={true}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserPermissionsModal(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.permissionsModalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('accessControls.permissions')} - {selectedUser.username}
                </Text>
                <Text style={[styles.permissionsCount, { color: colors.textSecondary }]}>
                  {assignedCount}/{REQUIRED_PERMISSIONS.length}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowUserPermissionsModal(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.permissionsScrollBody}>
              {PERMISSION_GROUPS.map((group) => {
                const groupPerms = group.permissions
                  .map(gp => ({ def: gp, dbPerm: permsByKey.get(gp.key) }))
                  .filter(item => item.dbPerm);

                if (groupPerms.length === 0) return null;

                const groupAssigned = groupPerms.filter(gp => userPermissions.includes(gp.dbPerm!.id)).length;

                return (
                  <View key={group.titleI18nKey} style={styles.permissionGroup}>
                    <View style={[styles.groupHeader, { backgroundColor: colors.cardBackground }]}>
                      <Ionicons
                        name={group.icon as any}
                        size={18}
                        color={colors.primary}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.groupTitle, { color: colors.text }]}>
                        {t(group.titleI18nKey)}
                      </Text>
                      <Text style={[styles.groupCount, { color: colors.textTertiary }]}>
                        {groupAssigned}/{groupPerms.length}
                      </Text>
                    </View>
                    {groupPerms.map(({ def, dbPerm }) => {
                      const isAssigned = userPermissions.includes(dbPerm!.id);
                      return (
                        <View
                          key={dbPerm!.id}
                          style={[
                            styles.permissionItem,
                            { borderBottomColor: colors.borderLight },
                            isAssigned && { backgroundColor: colors.primary + '10' },
                          ]}
                        >
                          <Text style={[styles.permissionText, { color: colors.text }]}>
                            {t(def.descriptionI18nKey)}
                          </Text>
                          <Switch
                            value={isAssigned}
                            onValueChange={() => togglePermission(dbPerm!.id)}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={Platform.OS === 'android' ? colors.background : undefined}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {!isMaster && (
          <View style={[styles.warningContainer, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <Text style={[styles.warningText, { color: colors.warning }]}>{t('accessControls.onlyMasterCanManage')}</Text>
          </View>
        )}

        {isMaster && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('accessControls.users')}</Text>
              <Button
                title={t('accessControls.createUser')}
                onPress={() => setShowCreateUserModal(true)}
                style={styles.createButton}
              />
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {users.length} {t('accessControls.users').toLowerCase()}
            </Text>

            {users.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('accessControls.noUsers')}</Text>
              </View>
            ) : (
              <View style={styles.usersList}>
                {users.map((userItem) => (
                  <View key={userItem.id} style={[styles.userCard, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>{userItem.username}</Text>
                      <Text style={[styles.userType, { color: colors.textSecondary }]}>{userItem.userType}</Text>
                      <View style={styles.userStatus}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: userItem.isActive ? colors.success : colors.textTertiary },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                          {userItem.isActive ? t('accessControls.isActive') : t('accessControls.deactivate')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.userActions}>
                      {userItem.userType !== 'Master' && (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                            onPress={() => handleToggleUserActive(userItem)}
                          >
                            <Ionicons
                              name={userItem.isActive ? 'close-circle' : 'checkmark-circle'}
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.info + '20' }]}
                            onPress={() => setShowUserPermissionsModal(userItem.id)}
                          >
                            <Ionicons name="key" size={20} color={colors.info} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                            onPress={() => setShowChangePasswordModal(userItem.id)}
                          >
                            <Ionicons name="lock-closed" size={20} color={colors.error} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={showCreateUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateUserModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCreateUserModal(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('accessControls.createUser')}</Text>
                  <TouchableOpacity onPress={() => setShowCreateUserModal(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                  <Input
                    label={t('auth.username')}
                    value={newUsername}
                    onChangeText={setNewUsername}
                    placeholder={t('auth.username')}
                    autoCapitalize="none"
                  />
                  <Input
                    label={t('auth.password')}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t('auth.password')}
                    secureTextEntry
                  />
                  <Dropdown
                    label={t('accessControls.userType')}
                    value={newUserType}
                    options={userTypeOptions}
                    onSelect={(value) => setNewUserType(value as UserType)}
                  />
                </ScrollView>
                <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                  <Button
                    title={t('common.cancel')}
                    onPress={() => {
                      setShowCreateUserModal(false);
                      setNewUsername('');
                      setNewPassword('');
                      setNewUserType('Viewer');
                    }}
                    variant="outline"
                    style={styles.modalButton}
                  />
                  <Button
                    title={t('common.create')}
                    onPress={handleCreateUser}
                    loading={createUserMutation.isPending}
                    disabled={!newUsername.trim() || !newPassword.trim()}
                    style={styles.modalButton}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {showUserPermissionsModal && <UserPermissionsModal userId={showUserPermissionsModal} />}
      
      {showChangePasswordModal && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowChangePasswordModal(null);
            setChangePasswordValue('');
          }}
        >
          <TouchableWithoutFeedback onPress={() => {
            setShowChangePasswordModal(null);
            setChangePasswordValue('');
          }}>
            <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                  <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      {t('accessControls.changePassword')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowChangePasswordModal(null);
                        setChangePasswordValue('');
                      }}
                    >
                      <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.modalBody}>
                    <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                      {users.find(u => u.id === showChangePasswordModal)?.username}
                    </Text>
                    <Input
                      label={t('accessControls.newPassword')}
                      value={changePasswordValue}
                      onChangeText={setChangePasswordValue}
                      placeholder={t('accessControls.newPasswordPlaceholder')}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                    <Button
                      title={t('common.cancel')}
                      onPress={() => {
                        setShowChangePasswordModal(null);
                        setChangePasswordValue('');
                      }}
                      variant="outline"
                      style={styles.modalButton}
                    />
                    <Button
                      title={t('common.save')}
                      onPress={handleChangePassword}
                      loading={changePasswordMutation.isPending}
                      disabled={!changePasswordValue.trim()}
                      style={styles.modalButton}
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  warningContainer: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
  },
  warningText: {
    fontSize: theme.typography.fontSize.sm,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  createButton: {
    minWidth: 120,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
  },
  usersList: {
    gap: theme.spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  userType: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
  },
  userActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  modalBody: {
    padding: theme.spacing.lg,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
  },
  modalButton: {
    flex: 1,
    minWidth: 100,
  },
  permissionsModalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...theme.shadows.lg,
  },
  permissionsScrollBody: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  permissionsCount: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  permissionGroup: {
    marginBottom: theme.spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  groupTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  groupCount: {
    fontSize: theme.typography.fontSize.xs,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    marginLeft: theme.spacing.sm,
  },
  permissionText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
});
