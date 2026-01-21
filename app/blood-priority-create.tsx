import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { repos } from '../src/services/container';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function BloodPriorityCreateScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [newMessageTitle, setNewMessageTitle] = useState('');
  const [newMessageBody, setNewMessageBody] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateMessage = async () => {
    if (!user) return;
    
    if (!newMessageTitle.trim() || !newMessageBody.trim()) {
      Alert.alert(t('common.error'), 'Please fill all fields');
      return;
    }

    setIsCreating(true);
    try {
      await repos.bloodPriorityRepo.createMessage({
        title: newMessageTitle.trim(),
        body: newMessageBody.trim(),
        createdBy: user.id,
      });
      router.back();
    } catch (error) {
      console.error('Error creating message:', error);
      Alert.alert(t('common.error'), t('common.error') + ': ' + t('bloodPriority.createMessage'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.md }}
    >
      <View style={styles.content}>
        <Input
          label={t('bloodPriority.messageTitle')}
          value={newMessageTitle}
          onChangeText={setNewMessageTitle}
          placeholder={t('bloodPriority.messageTitle')}
        />
        <Input
          label={t('bloodPriority.messageBody')}
          value={newMessageBody}
          onChangeText={setNewMessageBody}
          placeholder={t('bloodPriority.messageBody')}
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />
        <View style={styles.buttonContainer}>
          <Button
            title={t('common.cancel')}
            onPress={() => router.back()}
            variant="outline"
            style={styles.button}
          />
          <Button
            title={t('common.create')}
            onPress={handleCreateMessage}
            loading={isCreating}
            disabled={!newMessageTitle.trim() || !newMessageBody.trim()}
            style={styles.button}
          />
        </View>
      </View>
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
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  button: {
    flex: 1,
  },
});
