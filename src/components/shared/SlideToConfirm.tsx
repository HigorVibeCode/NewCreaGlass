import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { theme } from '../../theme';

interface SlideToConfirmProps {
  onConfirm: () => void;
  text?: string;
  confirmText?: string;
  disabled?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 64; // Padding
const THUMB_SIZE = 56;
const TRACK_HEIGHT = 56;
const MAX_SLIDE = SLIDER_WIDTH - THUMB_SIZE - 8;

export const SlideToConfirm: React.FC<SlideToConfirmProps> = ({
  onConfirm,
  text = 'Deslize para iniciar',
  confirmText = 'Iniciar',
  disabled = false,
}) => {
  const colors = useThemeColors();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const pan = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !isConfirmed,
      onMoveShouldSetPanResponder: () => !disabled && !isConfirmed,
      onPanResponderGrant: () => {
        pan.setOffset((pan as any)._value);
        pan.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = Math.max(0, Math.min(MAX_SLIDE, gestureState.dx));
        pan.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const currentValue = (pan as any)._value;
        
        if (currentValue >= MAX_SLIDE * 0.9) {
          // Confirmado - deslizou mais de 90%
          Animated.spring(pan, {
            toValue: MAX_SLIDE,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            setIsConfirmed(true);
            setTimeout(() => {
              onConfirm();
            }, 300);
          });
        } else {
          // Não confirmado - voltar ao início
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  const thumbTranslateX = pan.interpolate({
    inputRange: [0, MAX_SLIDE],
    outputRange: [0, MAX_SLIDE],
    extrapolate: 'clamp',
  });

  const trackOpacity = pan.interpolate({
    inputRange: [0, MAX_SLIDE * 0.9],
    outputRange: [0.3, 1],
    extrapolate: 'clamp',
  });

  const trackWidth = pan.interpolate({
    inputRange: [0, MAX_SLIDE],
    outputRange: [THUMB_SIZE, MAX_SLIDE + THUMB_SIZE],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.trackFill,
            {
              backgroundColor: colors.primary,
              opacity: trackOpacity,
              width: trackWidth,
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.trackText,
            {
              color: colors.text,
              opacity: pan.interpolate({
                inputRange: [0, MAX_SLIDE * 0.5],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          {text}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.trackConfirmText,
            {
              color: colors.textInverse || '#ffffff',
              opacity: pan.interpolate({
                inputRange: [MAX_SLIDE * 0.5, MAX_SLIDE],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          {confirmText}
        </Animated.Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            {
              backgroundColor: colors.background,
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={colors.primary}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  track: {
    width: SLIDER_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    position: 'absolute',
    zIndex: 1,
  },
  trackConfirmText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    position: 'absolute',
    zIndex: 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    left: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...theme.shadows.md,
    elevation: 5,
  },
});
