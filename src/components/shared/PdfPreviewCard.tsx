import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '../../theme';
import { useI18n } from '../../hooks/use-i18n';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { getSignedUrlFromStorage } from '../../utils/attachments';
import { canRenderPdf, getPdfThumbnail, PdfThumbnail } from '../../utils/pdf-preview';

interface PdfPreviewCardProps {
  storageKey: string;
  name: string;
  onPress: () => void;
}

const PREVIEW_HEIGHT = 170;
const PDF_RED = '#e5322d';

// WhatsApp-style PDF card: first page preview on top, file name and page count below
export const PdfPreviewCard: React.FC<PdfPreviewCardProps> = ({ storageKey, name, onPress }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [thumbnail, setThumbnail] = useState<PdfThumbnail | null>(null);
  const [failed, setFailed] = useState(!canRenderPdf);

  useEffect(() => {
    if (!canRenderPdf) return;
    let cancelled = false;
    setThumbnail(null);
    setFailed(false);
    (async () => {
      try {
        const url = await getSignedUrlFromStorage(storageKey, name);
        const result = await getPdfThumbnail(storageKey, url);
        if (!cancelled) setThumbnail(result);
      } catch (error) {
        console.warn('PDF preview failed:', name, error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, name]);

  const details = thumbnail
    ? `${t('attachmentViewer.pdfPages', { count: thumbnail.numPages })} · PDF`
    : 'PDF';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.preview}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail.uri }} style={styles.previewImage} contentFit="cover" contentPosition="top" />
        ) : failed ? (
          <Ionicons name="document-text" size={48} color={PDF_RED} />
        ) : (
          <ActivityIndicator color={colors.textSecondary} />
        )}
      </View>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PDF</Text>
        </View>
        <View style={styles.footerText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.details, { color: colors.textSecondary }]}>{details}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  preview: {
    height: PREVIEW_HEIGHT,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
  },
  badge: {
    backgroundColor: PDF_RED,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  footerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
  details: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
});
