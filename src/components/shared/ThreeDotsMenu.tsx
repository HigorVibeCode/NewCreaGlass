import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '../../hooks/use-i18n';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { isIosBrowser, usePwaInstall } from '../../hooks/use-pwa-install';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color?: string;
}

interface ThreeDotsMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const ThreeDotsMenu: React.FC<ThreeDotsMenuProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { t } = useI18n();
  const colors = useThemeColors();
  const { canOfferInstall, promptInstall } = usePwaInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    if (!visible) setShowInstallHelp(false);
  }, [visible]);

  const menuItems: MenuItem[] = [
    {
      icon: 'time-outline',
      label: t('navigation.point'),
      route: '/point',
      color: colors.primary,
    },
    {
      icon: 'person-outline',
      label: t('navigation.profile'),
      route: '/profile',
      color: colors.primary,
    },
    {
      icon: 'shield-checkmark-outline',
      label: t('navigation.accessControls'),
      route: '/access-controls',
      color: colors.info,
    },
    {
      icon: 'water-outline',
      label: t('navigation.bloodPriority'),
      route: '/blood-priority?manage=1',
      color: colors.error,
    },
  ];

  const handleMenuPress = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const handleInstallPress = async () => {
    const prompted = await promptInstall();
    if (prompted) onClose();
    // iPhone/iPad Safari and other browsers without an install dialog
    else setShowInstallHelp(true);
  };

  const installSteps = isIosBrowser()
    ? [t('pwa.iosStep1'), t('pwa.iosStep2'), t('pwa.iosStep3')]
    : [t('pwa.browserStep1'), t('pwa.browserStep2')];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <TouchableWithoutFeedback>
            <View style={[styles.menuContainer, { backgroundColor: colors.background }]}>
              {showInstallHelp ? (
                <View style={styles.installHelp}>
                  <View style={styles.installHelpHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="download-outline" size={24} color={colors.primary} />
                    </View>
                    <Text style={[styles.menuItemText, { color: colors.text }]}>{t('pwa.installApp')}</Text>
                  </View>
                  {installSteps.map((step, index) => (
                    <View key={index} style={styles.installStep}>
                      <Text style={[styles.installStepNumber, { color: colors.primary }]}>{index + 1}.</Text>
                      <Text style={[styles.installStepText, { color: colors.textSecondary }]}>{step}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.installHelpButton, { backgroundColor: colors.primary }]}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.installHelpButtonText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
              <>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => handleMenuPress(item.route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon} size={24} color={item.color} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {canOfferInstall && (
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
                  onPress={handleInstallPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="download-outline" size={24} color={colors.success} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{t('pwa.installApp')}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
              </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: theme.spacing.md,
  },
  menuContainer: {
    borderRadius: theme.borderRadius.lg,
    minWidth: 280,
    ...theme.shadows.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  menuItemText: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
  installHelp: {
    padding: theme.spacing.md,
    maxWidth: 320,
  },
  installHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  installStep: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  installStepNumber: {
    width: 22,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  installStepText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 20,
  },
  installHelpButton: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  installHelpButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
