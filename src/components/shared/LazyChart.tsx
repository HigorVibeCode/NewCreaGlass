import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

type ChartModule = typeof import('react-native-chart-kit');

let _chartModule: ChartModule | null = null;
let _loadPromise: Promise<ChartModule | null> | null = null;

function loadChartKit(): Promise<ChartModule | null> {
  if (_chartModule) return Promise.resolve(_chartModule);
  if (_loadPromise) return _loadPromise;
  _loadPromise = import('react-native-chart-kit')
    .then((mod) => {
      _chartModule = mod;
      return mod;
    })
    .catch((err) => {
      console.warn('[LazyChart] Failed to load react-native-chart-kit:', err);
      return null;
    });
  return _loadPromise;
}

export function useChartKit() {
  const [mod, setMod] = useState<ChartModule | null>(_chartModule);
  const [loading, setLoading] = useState(!_chartModule);

  useEffect(() => {
    if (_chartModule) {
      setMod(_chartModule);
      setLoading(false);
      return;
    }
    let mounted = true;
    loadChartKit().then((m) => {
      if (mounted) {
        setMod(m);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  return { chartKit: mod, loading };
}

export function ChartPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <ActivityIndicator size="small" color="#6366f1" />
    </View>
  );
}

export function ChartError() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.errorText}>Chart unavailable</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
