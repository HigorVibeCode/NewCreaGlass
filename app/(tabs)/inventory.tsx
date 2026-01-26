import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { Dropdown } from '../../src/components/shared/Dropdown';
import { repos } from '../../src/services/container';
import { InventoryGroup, InventoryItem } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';

export default function InventoryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const allGroups = await repos.inventoryRepo.getAllGroups();
      setGroups(allGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleGroupPress = (groupId: string) => {
    router.push({
      pathname: '/inventory-group',
      params: { groupId },
    });
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
      const dateStr = reportDate.toLocaleDateString('pt-BR');
      const timeStr = reportDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      console.log('Generating HTML for PDF...');
      // Generate HTML for PDF
      let html: string;
      try {
        html = await generateReportHTML(
          selectedClient,
          reportId,
          dateStr,
          timeStr,
          filteredItems,
          t
        );
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
      
      // Share the PDF (mobile only)
      if (Platform.OS !== 'web') {
        console.log('Sharing PDF...');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('inventory.shareReport'),
          });
          console.log('PDF shared successfully');
        } else {
          Alert.alert(t('inventory.reportGenerated'), `${t('inventory.reportSaved')} ${uri}`);
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

  const getLogoBase64 = async (): Promise<string> => {
    try {
      const logoModule = require('../../assets/images/login-logo.png');
      console.log('Logo module loaded:', typeof logoModule, logoModule);
      
      if (Platform.OS === 'web') {
        // On web, try to get the URL from the module
        let logoUrl: string = '';
        
        if (typeof logoModule === 'string') {
          logoUrl = logoModule;
        } else if (typeof logoModule === 'object') {
          // Try different possible properties
          logoUrl = logoModule.default || logoModule.uri || logoModule.src || logoModule.toString() || '';
        }
        
        console.log('Logo URL extracted:', logoUrl);
        
        if (logoUrl && typeof logoUrl === 'string' && logoUrl.length > 0) {
          try {
            // Fetch the image and convert to base64
            const response = await fetch(logoUrl);
            console.log('Fetch response status:', response.status, response.ok);
            
            if (response.ok) {
              const blob = await response.blob();
              console.log('Blob created, size:', blob.size);
              
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  console.log('Logo converted to base64, length:', result.length);
                  resolve(result);
                };
                reader.onerror = (error) => {
                  console.warn('FileReader error:', error);
                  resolve('');
                };
                reader.readAsDataURL(blob);
              });
            } else {
              console.warn('Fetch failed with status:', response.status);
            }
          } catch (fetchError) {
            console.warn('Error fetching logo:', fetchError);
          }
        }
        
        // Fallback: try common Expo/Metro paths and public folder
        const fallbackPaths = [
          '/assets/images/login-logo.png',
          '/public/assets/images/login-logo.png',
          './assets/images/login-logo.png',
          './public/assets/images/login-logo.png',
          '/_expo/static/assets/images/login-logo.png',
          '/static/assets/images/login-logo.png',
        ];
        
        for (const path of fallbackPaths) {
          try {
            const response = await fetch(path);
            if (response.ok) {
              const blob = await response.blob();
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
              });
            }
          } catch (e) {
            continue;
          }
        }
        
        console.warn('Could not load logo from any path');
        return '';
      } else {
        // On mobile, load from asset bundle using FileSystem
        let uri: string = '';
        
        if (typeof logoModule === 'object') {
          uri = logoModule.uri || logoModule.default || '';
        } else if (typeof logoModule === 'string') {
          uri = logoModule;
        }
        
        if (!uri) {
          console.warn('Logo URI is empty');
          return '';
        }
        
        console.log('Loading logo from URI:', uri);
        
        // Read the file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('Logo loaded successfully, base64 length:', base64.length);
        return `data:image/png;base64,${base64}`;
      }
    } catch (error) {
      console.warn('Could not load logo:', error);
      return '';
    }
  };

  const generateReportHTML = async (
    clientName: string,
    reportId: string,
    date: string,
    time: string,
    items: InventoryItem[],
    t: any
  ): Promise<string> => {
    // Try to load logo, but don't block if it fails (timeout after 3 seconds)
    let logoImg = '';
    try {
      console.log('Starting logo load...');
      const logoBase64 = await Promise.race([
        getLogoBase64(),
        new Promise<string>((resolve) => {
          setTimeout(() => {
            console.log('Logo load timeout after 3 seconds');
            resolve('');
          }, 3000);
        })
      ]);
      
      if (logoBase64 && logoBase64.length > 0) {
        // Verify it's a valid data URL
        if (logoBase64.startsWith('data:image')) {
          logoImg = `<img src="${logoBase64}" alt="Crea Glass Logo" class="logo" style="display: block;" />`;
          console.log('Logo loaded successfully, length:', logoBase64.length, 'starts with:', logoBase64.substring(0, 50));
        } else {
          console.warn('Logo base64 does not start with data:image, got:', logoBase64.substring(0, 50));
        }
      } else {
        console.log('Logo not loaded or empty');
      }
    } catch (logoError) {
      console.warn('Logo loading failed, continuing without logo:', logoError);
    }
    const itemsRows = items.map((item, index) => {
      const reference = item.referenceNumber || item.id.substring(0, 8).toUpperCase();
      const description = item.name;
      const stock = item.stock || 0;
      const unit = item.unit || '';
      const location = item.location || '-';
      
      // Glass-specific dimensions
      const dimensions = item.height && item.width && item.thickness
        ? `${item.width}mm × ${item.height}mm × ${item.thickness}mm`
        : '-';
      
      // Calculate total m² (totalM2 * stock)
      const totalM2 = item.totalM2 && stock ? (item.totalM2 * stock).toFixed(2) : '-';

      return `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 8px; text-align: center;">${index + 1}</td>
          <td style="padding: 8px;">${reference}</td>
          <td style="padding: 8px;">${description}</td>
          <td style="padding: 8px;">${dimensions}</td>
          <td style="padding: 8px; text-align: right;">${stock}</td>
          <td style="padding: 8px;">${unit}</td>
          <td style="padding: 8px; text-align: right;">${totalM2}</td>
          <td style="padding: 8px;">${location}</td>
        </tr>
      `;
    }).join('');

    console.log('Items rows generated, count:', items.length);
    console.log('Logo image:', logoImg ? 'present' : 'not present');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório de Inventário - ${clientName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              border-bottom: 3px solid #0066cc;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .header-left {
              flex: 1;
            }
            .header h1 {
              margin: 0;
              color: #0066cc;
              font-size: 24px;
            }
            .header-info {
              margin-top: 10px;
              font-size: 12px;
              color: #666;
            }
            .logo-container {
              margin-left: 20px;
              display: flex;
              align-items: center;
              justify-content: flex-end;
            }
            .logo {
              max-width: 200px;
              max-height: 100px;
              height: auto;
              width: auto;
              object-fit: contain;
            }
            .info-section {
              margin-bottom: 20px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 12px;
            }
            .info-label {
              font-weight: bold;
              color: #555;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 11px;
            }
            thead {
              background-color: #f5f5f5;
            }
            th {
              padding: 10px 8px;
              text-align: left;
              font-weight: bold;
              border-bottom: 2px solid #0066cc;
              color: #333;
            }
            td {
              padding: 8px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 10px;
              color: #666;
              text-align: center;
            }
            @media print {
              body {
                margin: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1>${t('inventory.inventoryReport')}</h1>
              <div class="header-info">
                ${t('inventory.reportId')}: ${reportId} | ${date} ${time}
              </div>
            </div>
            <div class="logo-container">
              ${logoImg}
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">${t('inventory.client')}:</span>
              <span>${clientName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t('inventory.reportDate')}:</span>
              <span>${date} ${time}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t('inventory.totalItems')}:</span>
              <span>${items.length}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 12%;">${t('inventory.referenceCode')}</th>
                <th style="width: 20%;">${t('inventory.description')}</th>
                <th style="width: 15%;">${t('inventory.dimensions')}</th>
                <th style="width: 10%; text-align: right;">${t('inventory.stock')}</th>
                <th style="width: 8%;">${t('inventory.unit')}</th>
                <th style="width: 10%; text-align: right;">${t('inventory.totalM2')}</th>
                <th style="width: 12%;">${t('inventory.location')}</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="footer">
            <p>${t('inventory.reportGeneratedBy')} Crea Glass System</p>
            <p>${t('inventory.reportId')}: ${reportId}</p>
          </div>
        </body>
      </html>
    `;
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
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[styles.groupCard, { backgroundColor: colors.cardBackground }]}
                    onPress={() => handleGroupPress(group.id)}
                  >
                    <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                  </TouchableOpacity>
                ))}
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
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  groupName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    zIndex: 1000,
    elevation: 1000,
  },
  modalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 500,
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
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
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
