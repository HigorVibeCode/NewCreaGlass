import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Alert, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { Dropdown } from '../../src/components/shared/Dropdown';
import {
  getInventoryGroupColor,
  getInventoryGroupIcon,
  INVENTORY_GROUP_NAMES,
  isGlassInventoryGroup,
} from '../../src/constants/inventory-groups';
import { getLogoBase64 } from '../../src/utils/logo-base64';
import { generateInventoryReportHTML } from '../../src/utils/inventory-report-pdf';
import { repos } from '../../src/services/container';
import { InventoryGroup } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { formatDate as formatDateUtil, formatTime as formatTimeUtil } from '../../src/utils/date-format';
import { pushWithParams } from '../../src/utils/navigation';

const INVENTORY_GROUP_DISPLAY_ORDER: string[] = [
  INVENTORY_GROUP_NAMES.GLASS,
  INVENTORY_GROUP_NAMES.PROFILES,
  INVENTORY_GROUP_NAMES.SUPPLIES,
  INVENTORY_GROUP_NAMES.MONTAGE_ACCESSORIES,
];

export default function InventoryScreen() {
  'use no memo';
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const allGroups = await repos.inventoryRepo.getAllGroups();
      const sorted = [...allGroups].sort((a, b) => {
        const ai = INVENTORY_GROUP_DISPLAY_ORDER.indexOf(a.name);
        const bi = INVENTORY_GROUP_DISPLAY_ORDER.indexOf(b.name);
        const orderA = ai === -1 ? INVENTORY_GROUP_DISPLAY_ORDER.length : ai;
        const orderB = bi === -1 ? INVENTORY_GROUP_DISPLAY_ORDER.length : bi;
        return orderA - orderB || a.name.localeCompare(b.name);
      });
      setGroups(sorted);
    } catch (error) {
      console.error('Error loading inventory groups:', error);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadGroups();
    }
  }, [isFocused, loadGroups]);

  const handleGroupPress = (groupId: string) => {
    pushWithParams(router, '/inventory-group', { groupId: String(groupId) });
  };

  const handleGenerateReport = () => {
    console.log('Generate Report button clicked');
    setShowReportModal(true);
    console.log('Modal state set to true');
  };

  const handleClientSelect = (value: string) => {
    setSelectedClient(value);
  };

  const generatePDF = async () => {
    if (!selectedClient) {
      Alert.alert(t('common.error'), t('inventory.selectClientFirst'));
      return;
    }

    console.log('Starting PDF generation for client:', selectedClient);
    setIsGenerating(true);
    
    try {
      // Get all inventory items
      console.log('Fetching all inventory items...');
      const allItems = await repos.inventoryRepo.getAllItems();
      console.log('Total items fetched:', allItems.length);
      
      // Filter items by selected client (supplier)
      const filteredItems = allItems.filter(item => item.supplier === selectedClient);
      console.log('Filtered items for', selectedClient, ':', filteredItems.length);

      if (filteredItems.length === 0) {
        Alert.alert(
          t('inventory.noItemsFound'),
          `${t('inventory.noItemsForClient')} ${selectedClient}`
        );
        setIsGenerating(false);
        return;
      }

      // Generate report ID
      const reportId = `INV-${Date.now()}`;
      const reportDate = new Date();
      const dateStr = formatDateUtil(reportDate);
      const timeStr = formatTimeUtil(reportDate);

      console.log('Generating HTML for PDF...');
      // Generate HTML for PDF
      let html: string;
      try {
        const groupNames = new Map(groups.map((group) => [group.id, group.name]));
        const logoDataUrl = await Promise.race([
          getLogoBase64().catch(() => ''),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), 3000)),
        ]);
        html = generateInventoryReportHTML({
          supplier: selectedClient,
          reportId,
          date: dateStr,
          time: timeStr,
          items: filteredItems,
          isGlassItem: (item) =>
            isGlassInventoryGroup(groupNames.get(item.groupId)) || (!!item.width && !!item.height),
          logoDataUrl: logoDataUrl.startsWith('data:image') ? logoDataUrl : undefined,
          t,
        });
        console.log('HTML generated, length:', html.length);
        console.log('HTML starts with:', html.substring(0, 200));
        
        if (!html || html.length === 0) {
          throw new Error('HTML generation returned empty string');
        }
      } catch (htmlError) {
        console.error('Error generating HTML:', htmlError);
        Alert.alert(
          t('common.error'),
          `Erro ao gerar HTML do relatório: ${htmlError instanceof Error ? htmlError.message : String(htmlError)}`
        );
        setIsGenerating(false);
        return;
      }

      // Generate PDF
      console.log('Generating PDF...');
      let uri: string;
      
      if (Platform.OS === 'web') {
        // On web, use print dialog
        console.log('Platform is web, using print dialog');
        try {
          if (typeof window !== 'undefined') {
            // Create a blob URL from the HTML to ensure it's treated as a document
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            
            if (printWindow) {
              // Wait for the window to load the content
              printWindow.onload = () => {
                setTimeout(() => {
                  if (printWindow && !printWindow.closed) {
                    printWindow.focus();
                    printWindow.print();
                    // Clean up the blob URL after printing
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }
                }, 500);
              };
              
              // Fallback if onload doesn't fire
              setTimeout(() => {
                if (printWindow && !printWindow.closed) {
                  printWindow.focus();
                  printWindow.print();
                  URL.revokeObjectURL(url);
                }
              }, 1000);
              Alert.alert(
                t('inventory.reportGenerated'),
                t('inventory.reportPrintDialogOpened')
              );
              setShowReportModal(false);
              setSelectedClient('');
              setIsGenerating(false);
              return;
            } else {
              // Fallback: try to use Print.printToFileAsync even on web
              console.log('Could not open print window, trying printToFileAsync...');
              const result = await Print.printToFileAsync({ html });
              uri = result.uri;
              console.log('PDF generated at:', uri);
              // On web, we can't share, so just show the URI
              Alert.alert(
                t('inventory.reportGenerated'),
                `${t('inventory.reportSaved')} ${uri}`
              );
              setShowReportModal(false);
              setSelectedClient('');
              setIsGenerating(false);
              return;
            }
          } else {
            throw new Error('Window object not available');
          }
        } catch (webError) {
          console.error('Error with web print:', webError);
          // Fallback to printToFileAsync
          const result = await Print.printToFileAsync({ html });
          uri = result.uri;
          console.log('PDF generated at (fallback):', uri);
        }
      } else {
        // On mobile, generate PDF file
        const result = await Print.printToFileAsync({ html });
        uri = result.uri;
        console.log('PDF generated at:', uri);
      }
      
      // Open the PDF in default app (mobile only)
      if (Platform.OS !== 'web') {
        console.log('Opening PDF with default app...');
        try {
          if (Platform.OS === 'android') {
            const contentUri = await FileSystemLegacy.getContentUriAsync(uri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
              type: 'application/pdf',
            });
          } else {
            const canOpen = await Linking.canOpenURL(uri);
            if (!canOpen) {
              throw new Error('Cannot open PDF URI');
            }
            await Linking.openURL(uri);
          }
        } catch (openError) {
          console.warn('Could not open PDF with default app, falling back to share:', openError);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: t('inventory.shareReport'),
            });
          } else {
            Alert.alert(t('inventory.reportGenerated'), `${t('inventory.reportSaved')} ${uri}`);
          }
        }
      }

      setShowReportModal(false);
      setSelectedClient('');
      console.log('PDF generation completed successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        t('common.error'), 
        `${t('inventory.reportGenerationError')}: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('inventory.groups')}</Text>
              <TouchableOpacity
                style={[styles.generateButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  console.log('Button pressed - calling handleGenerateReport');
                  handleGenerateReport();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text" size={20} color={colors.textInverse} />
                <Text style={[styles.generateButtonText, { color: colors.textInverse }]}>
                  {t('inventory.generateReport')}
                </Text>
              </TouchableOpacity>
            </View>
            
            {groups.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('inventory.noGroups')}</Text>
            ) : (
              <View style={styles.groupsList}>
                {groups.map((group) => {
                  const iconName = getInventoryGroupIcon(group.name);
                  const iconColor = getInventoryGroupColor(group.name, colors.primary);
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupCard, { backgroundColor: colors.cardBackground }]}
                      onPress={() => handleGroupPress(group.id)}
                    >
                      <View style={[styles.groupIconWrap, { backgroundColor: iconColor + '15' }]}>
                        <Ionicons name={iconName} size={28} color={iconColor} />
                      </View>
                      <View style={styles.groupCardText}>
                        <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Report Generation Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          console.log('Modal onRequestClose called');
          setShowReportModal(false);
          setSelectedClient('');
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowReportModal(false);
          setSelectedClient('');
        }}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {t('inventory.generateReport')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowReportModal(false);
                      setSelectedClient('');
                    }}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalBody}>
                  <Dropdown
                    label={t('inventory.selectClient')}
                    value={selectedClient}
                    options={[
                      { label: '3S', value: '3S' },
                      { label: 'Crea Glass', value: 'Crea Glass' },
                      { label: 'Kromatix', value: 'Kromatix' },
                    ]}
                    onSelect={handleClientSelect}
                  />
                  
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: colors.backgroundSecondary },
                        !selectedClient && styles.modalButtonDisabled
                      ]}
                      onPress={() => {
                        setShowReportModal(false);
                        setSelectedClient('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                        {t('common.cancel')}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: colors.primary },
                        (!selectedClient || isGenerating) && styles.modalButtonDisabled
                      ]}
                      onPress={generatePDF}
                      disabled={!selectedClient || isGenerating}
                      activeOpacity={0.7}
                    >
                      {isGenerating ? (
                        <Text style={[styles.modalButtonText, { color: colors.textInverse }]}>
                          {t('inventory.generating')}...
                        </Text>
                      ) : (
                        <Text style={[styles.modalButtonText, { color: colors.textInverse }]}>
                          {t('inventory.generate')}
                        </Text>
                      )}
                    </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  generateButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  groupsList: {
    gap: theme.spacing.md,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
    gap: theme.spacing.md,
  },
  groupIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCardText: {
    flex: 1,
  },
  groupName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  modalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    zIndex: 1001,
    elevation: 1001,
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
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 0,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
