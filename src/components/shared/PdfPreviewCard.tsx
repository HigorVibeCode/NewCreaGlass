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

const PDF_RED = '#e5322d';

// PDF thumbnail tile: first page as preview (like WhatsApp), PDF badge, page count and name
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
        const result = await getPdfThumbnail(storageKey, url, 300);
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

  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.7} accessibilityLabel={name}>
      <View style={[styles.preview, { backgroundColor: thumbnail ? '#ffffff' : colors.backgroundSecondary }]}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail.uri }} style={styles.previewImage} contentFit="cover" contentPosition="top" />
        ) : failed ? (
          <Ionicons name="document-text" size={36} color={PDF_RED} />
        ) : (
          <ActivityIndicator color={colors.textSecondary} />
        )}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PDF</Text>
          </View>
          {thumbnail && thumbnail.numPages > 1 && (
            <View style={styles.pages}>
              <Text style={styles.pagesText}>{t('attachmentViewer.pdfPages', { count: thumbnail.numPages })}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={2}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};

// Same size as the image thumbnails, so PDFs and photos line up in the attachments grid
const TILE_SIZE = 100;

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
  },
  preview: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    backgroundColor: PDF_RED,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  pages: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pagesText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  name: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
});
