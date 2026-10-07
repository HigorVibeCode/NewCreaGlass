import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { SvgXml } from 'react-native-svg';
import { theme } from '../../theme';
import { useI18n } from '../../hooks/use-i18n';
import { getSignedUrlFromStorage, downloadAndOpenAttachment } from '../../utils/attachments';
import { isDxfFile } from '../../utils/production-attachment-storage';
import { dxfToSvg } from '../../utils/dxf-to-svg';

export interface ViewerAttachment {
  storageKey: string;
  name: string;
  mimeType: string;
}

export type ViewerKind = 'image' | 'pdf' | 'dxf' | 'other';

export const getViewerKind = (name: string, mimeType: string): ViewerKind => {
  const mime = (mimeType || '').toLowerCase();
  if (isDxfFile(name, mimeType)) return 'dxf';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'other';
};

// Android's WebView cannot render PDFs, so there the device's PDF viewer is used directly
export const canViewInApp = (kind: ViewerKind): boolean =>
  kind === 'image' || kind === 'dxf' || (kind === 'pdf' && Platform.OS !== 'android');

interface AttachmentViewerProps {
  attachments: ViewerAttachment[]; // images: swipe through all of them
  index: number | null; // null = closed
  onClose: () => void;
}

const DARK_BG = '#0b0f17';

export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachments, index, onClose }) => {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index ?? 0);
  const [url, setUrl] = useState<string | null>(null);
  const [dxfSvg, setDxfSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  const attachment = index !== null ? attachments[current] : undefined;
  const kind = attachment ? getViewerKind(attachment.name, attachment.mimeType) : 'other';
  const imageIndexes = attachments
    .map((att, i) => (getViewerKind(att.name, att.mimeType) === 'image' ? i : -1))
    .filter((i) => i >= 0);
  const imagePosition = imageIndexes.indexOf(current);

  useEffect(() => {
    if (!attachment) return;
    let cancelled = false;
    setUrl(null);
    setDxfSvg(null);
    setError(null);
    setIsLoading(true);
    (async () => {
      try {
        const signed = await getSignedUrlFromStorage(attachment.storageKey, attachment.name);
        if (cancelled) return;
        if (kind === 'dxf') {
          const response = await fetch(signed);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const preview = dxfToSvg(await response.text(), '#e5e7eb');
          if (cancelled) return;
          if (!preview) throw new Error(t('attachmentViewer.dxfEmpty'));
          setDxfSvg(preview.svg);
        } else {
          setUrl(signed);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment, kind, t]);

  const handleDownload = () => {
    if (!attachment) return;
    downloadAndOpenAttachment(attachment.storageKey, attachment.name, attachment.mimeType).catch((err) =>
      console.error('Error downloading attachment:', err)
    );
  };

  const goTo = (offset: number) => {
    const next = imageIndexes[imagePosition + offset];
    if (next !== undefined) setCurrent(next);
  };

  const bodyHeight = height - insets.top - insets.bottom - 64;

  const renderBody = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" color="#fff" />;
    }
    if (error) {
      return (
        <View style={styles.message}>
          <Ionicons name="alert-circle-outline" size={40} color="#9ca3af" />
          <Text style={styles.messageText}>{t('attachmentViewer.loadError')}</Text>
          <Text style={styles.messageDetail}>{error}</Text>
        </View>
      );
    }
    if (kind === 'dxf' && dxfSvg) {
      return (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.center}
          maximumZoomScale={6}
          minimumZoomScale={1}
          centerContent
        >
          <SvgXml xml={dxfSvg} width={width - 24} height={bodyHeight - 24} />
        </ScrollView>
      );
    }
    if (kind === 'image' && url) {
      return (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.center}
          maximumZoomScale={5}
          minimumZoomScale={1}
          centerContent
        >
          <Image source={{ uri: url }} style={{ width, height: bodyHeight }} contentFit="contain" />
        </ScrollView>
      );
    }
    if (kind === 'pdf' && url) {
      if (Platform.OS === 'web') {
        return React.createElement('iframe', {
          src: url,
          title: attachment?.name,
          style: { width: '100%', height: '100%', border: 'none', background: '#fff' },
        });
      }
      return <WebView source={{ uri: url }} style={styles.fill} startInLoadingState />;
    }
    return null;
  };

  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={1}>
              {attachment?.name}
            </Text>
            {kind === 'image' && imageIndexes.length > 1 && (
              <Text style={styles.subtitle}>
                {imagePosition + 1} / {imageIndexes.length}
              </Text>
            )}
            {kind === 'dxf' && <Text style={styles.subtitle}>{t('attachmentViewer.dxfPreview')}</Text>}
          </View>
          <TouchableOpacity
            onPress={handleDownload}
            style={styles.headerButton}
            accessibilityLabel={t('attachmentViewer.download')}
          >
            <Ionicons name="download-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {renderBody()}
          {kind === 'image' && imagePosition > 0 && (
            <TouchableOpacity style={[styles.navButton, styles.navLeft]} onPress={() => goTo(-1)}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          {kind === 'image' && imagePosition >= 0 && imagePosition < imageIndexes.length - 1 && (
            <TouchableOpacity style={[styles.navButton, styles.navRight]} onPress={() => goTo(1)}>
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#fff',
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
    width: '100%',
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  messageDetail: {
    color: '#6b7280',
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: {
    left: theme.spacing.sm,
  },
  navRight: {
    right: theme.spacing.sm,
  },
});
