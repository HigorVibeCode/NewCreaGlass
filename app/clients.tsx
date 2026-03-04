import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { Input } from '../src/components/shared/Input';
import { Button } from '../src/components/shared/Button';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { repos } from '../src/services/container';
import { Client } from '../src/types';
import { theme } from '../src/theme';

export default function ClientsScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');

  const loadClients = useCallback(async () => {
    try {
      const allClients = await repos.clientsRepo.getAllClients();
      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert(t('common.error'), t('clients.loadError'));
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(term) ||
        (client.address || '').toLowerCase().includes(term) ||
        (client.contact || '').toLowerCase().includes(term)
      );
    });
  }, [clients, query]);

  const resetForm = () => {
    setEditingClient(null);
    setName('');
    setAddress('');
    setContact('');
    setIsFormModalVisible(false);
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setAddress('');
    setContact('');
    setIsFormModalVisible(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setAddress(client.address || '');
    setContact(client.contact || '');
    setIsFormModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('clients.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      if (editingClient) {
        await repos.clientsRepo.updateClient(editingClient.id, {
          name: name.trim(),
          address: address.trim() || undefined,
          contact: contact.trim() || undefined,
        });
      } else {
        await repos.clientsRepo.createClient({
          name: name.trim(),
          address: address.trim() || undefined,
          contact: contact.trim() || undefined,
          isActive: true,
        });
      }
      resetForm();
      await loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      Alert.alert(t('common.error'), t('clients.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (client: Client) => {
    confirmDelete(
      t('clients.deactivateTitle'),
      t('clients.deactivateConfirm', { name: client.name }),
      async () => {
        await repos.clientsRepo.deleteClient(client.id);
        await loadClients();
      },
      undefined,
      t('clients.deactivate'),
      t('common.cancel'),
      t('clients.deactivateSuccess'),
      t('clients.deactivateError')
    );
  };

  const renderClientCard = (item: Client) => (
    <View style={[styles.clientCard, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.clientInfo}>
        <Text style={[styles.clientName, { color: colors.text }]}>{item.name}</Text>
        {!!item.address && <Text style={[styles.clientMeta, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>}
        {!!item.contact && <Text style={[styles.clientMeta, { color: colors.textSecondary }]}>{item.contact}</Text>}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => openEditModal(item)}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: insets.top + theme.spacing.md }]}>
        <TouchableOpacity style={styles.iconButton} onPress={goBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('clients.title')}</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('clients.searchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={openCreateModal}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? (
          <ScrollView style={styles.webListScroll} contentContainerStyle={styles.listContent}>
            {filteredClients.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('clients.empty')}</Text>
            ) : (
              filteredClients.map((item) => <View key={item.id}>{renderClientCard(item)}</View>)
            )}
          </ScrollView>
        ) : (
          <FlatList
            style={styles.mobileList}
            data={filteredClients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => renderClientCard(item)}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('clients.empty')}</Text>}
          />
        )}
      </View>

      <Modal
        visible={isFormModalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetForm}
      >
        <TouchableWithoutFeedback onPress={resetForm}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {editingClient ? t('clients.editClient') : t('clients.newClient')}
                  </Text>
                  <TouchableOpacity onPress={resetForm}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                  <Input label={t('clients.name')} value={name} onChangeText={setName} placeholder={t('clients.namePlaceholder')} />
                  <Input label={t('clients.address')} value={address} onChangeText={setAddress} placeholder={t('clients.addressPlaceholder')} />
                  <Input label={t('clients.contact')} value={contact} onChangeText={setContact} placeholder={t('clients.contactPlaceholder')} />
                  <View style={styles.formActions}>
                    <Button title={t('common.cancel')} variant="outline" onPress={resetForm} style={styles.formButton} />
                    <Button title={editingClient ? t('common.save') : t('common.create')} onPress={handleSave} loading={isSaving} style={styles.formButton} />
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, borderBottomWidth: 1 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold },
  content: { flex: 1, padding: theme.spacing.md, gap: theme.spacing.md },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  searchInput: { flex: 1, paddingVertical: theme.spacing.sm, fontSize: theme.typography.fontSize.md },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  formActions: { flexDirection: 'row', gap: theme.spacing.sm },
  formButton: { flex: 1 },
  mobileList: { flex: 1 },
  webListScroll: { flex: 1 },
  listContent: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  clientCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...theme.shadows.sm },
  clientInfo: { flex: 1, marginRight: theme.spacing.md },
  clientName: { fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.semibold },
  clientMeta: { fontSize: theme.typography.fontSize.xs, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: theme.spacing.md },
  emptyText: { textAlign: 'center', padding: theme.spacing.lg },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 420,
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
  formContainer: {
    padding: theme.spacing.lg,
  },
});
