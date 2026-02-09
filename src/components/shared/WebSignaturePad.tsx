import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

interface WebSignaturePadProps {
  onOK?: (base64: string) => void;
  onEmpty?: () => void;
  penColor?: string;
  backgroundColor?: string;
  clearText?: string;
  confirmText?: string;
  borderColor?: string;
  primaryColor?: string;
  textColor?: string;
}

export interface WebSignaturePadRef {
  readSignature: () => void;
  clearSignature: () => void;
}

export const WebSignaturePad = forwardRef<WebSignaturePadRef, WebSignaturePadProps>(
  (
    {
      onOK,
      onEmpty,
      penColor = '#000000',
      backgroundColor = '#ffffff',
      clearText = 'Clear',
      confirmText = 'Save',
      borderColor = '#e5e7eb',
      primaryColor = '#2563eb',
      textColor = '#ffffff',
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const hasContentRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const getCanvasPoint = useCallback(
      (e: MouseEvent | Touch): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      },
      []
    );

    const startDrawing = useCallback(
      (point: { x: number; y: number }) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        isDrawingRef.current = true;
        hasContentRef.current = true;
        lastPointRef.current = point;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      },
      []
    );

    const draw = useCallback(
      (point: { x: number; y: number }) => {
        if (!isDrawingRef.current) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !lastPointRef.current) return;
        ctx.strokeStyle = penColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPointRef.current = point;
      },
      [penColor]
    );

    const stopDrawing = useCallback(() => {
      isDrawingRef.current = false;
      lastPointRef.current = null;
    }, []);

    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
    }, [backgroundColor]);

    const readSignature = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !hasContentRef.current) {
        onEmpty?.();
        return;
      }
      const base64 = canvas.toDataURL('image/png');
      onOK?.(base64);
    }, [onOK, onEmpty]);

    useImperativeHandle(ref, () => ({
      readSignature,
      clearSignature: clearCanvas,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Set canvas resolution
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;

      // Fill background
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Mouse events
      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startDrawing(getCanvasPoint(e));
      };
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        draw(getCanvasPoint(e));
      };
      const handleMouseUp = () => stopDrawing();

      // Touch events
      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          startDrawing(getCanvasPoint(e.touches[0]));
        }
      };
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          draw(getCanvasPoint(e.touches[0]));
        }
      };
      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        stopDrawing();
      };

      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }, [backgroundColor, startDrawing, draw, stopDrawing, getCanvasPoint]);

    return (
      <View style={styles.container}>
        <View style={[styles.canvasWrapper, { borderColor }]}>
          {/* @ts-ignore - canvas is a web-only element */}
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              touchAction: 'none',
              cursor: 'crosshair',
            }}
          />
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: '#e5e7eb' }]}
            onPress={clearCanvas}
            activeOpacity={0.7}
          >
            <Text style={[styles.footerButtonText, { color: '#374151' }]}>{clearText}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: primaryColor }]}
            onPress={readSignature}
            activeOpacity={0.7}
          >
            <Text style={[styles.footerButtonText, { color: textColor }]}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  canvasWrapper: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  footerButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  footerButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
