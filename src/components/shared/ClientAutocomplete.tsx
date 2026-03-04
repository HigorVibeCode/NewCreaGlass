import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useI18n } from '../../hooks/use-i18n';
import { Client } from '../../types';

interface ClientAutocompleteProps {
  label: string;
  clients: Client[];
  selectedClientId?: string;
  placeholder?: string;
  onSelectClient: (client: Client) => void;
  onManageClientsPress?: () => void;
}

export const ClientAutocomplete: React.FC<ClientAutocompleteProps> = ({
  label,
  clients,
  selectedClientId,
  placeholder,
  onSelectClient,
  onManageClientsPress,
}) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!selectedClientId) {
      setQuery('');
      return;
    }
    const selected = clients.find((client) => client.id === selectedClientId);
    if (selected) setQuery(selected.name);
  }, [selectedClientId, clients]);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => client.name.toLowerCase().includes(term));
  }, [clients, query]);

  const handleSelect = (client: Client) => {
    setQuery(client.name);
    setIsOpen(false);
    onSelectClient(client);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {onManageClientsPress && (
          <TouchableOpacity onPress={onManageClientsPress} activeOpacity={0.7}>
            <Text style={[styles.manageText, { color: colors.primary }]}>{t('clients.manage')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text }]}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      {isOpen && (
        <View style={[styles.resultsContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
          {filteredClients.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('clients.empty')}</Text>
          ) : (
            Platform.OS === 'web' ? (
              <View style={styles.resultsWebScroll as any}>
                {filteredClients.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.resultItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.resultTitle, { color: colors.text }]}>{item.name}</Text>
                    {!!item.address && (
                      <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.address}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <ScrollView
                style={styles.resultsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {filteredClients.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.resultItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.resultTitle, { color: colors.text }]}>{item.name}</Text>
                    {!!item.address && (
                      <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.address}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    zIndex: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  manageText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    paddingVertical: theme.spacing.md,
  },
  resultsContainer: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  resultsScroll: {
    maxHeight: 220,
  },
  resultsWebScroll: {
    maxHeight: 220,
    overflowY: 'auto',
  },
  resultItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  resultTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  resultSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  emptyText: {
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
});
