import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/hooks/use-i18n';
import { HapticTab } from '@/components/haptic-tab';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { TopBar } from '../../src/components/shared/TopBar';

export default function TabLayout() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <TopBar />
      <View style={styles.tabsContainer}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textTertiary,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 70 + insets.bottom,
              paddingBottom: insets.bottom + 8,
              paddingTop: 10,
              ...(Platform.OS === 'web' && {
                maxWidth: 1400,
                width: '100%',
                alignSelf: 'center',
              }),
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: theme.typography.fontWeight.medium,
            },
            animation: 'shift',
          }}>
      <Tabs.Screen
        name="production"
        options={{
          title: t('navigation.production'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'construct' : 'construct-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: t('navigation.documents'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'book' : 'book-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t('navigation.events'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'calendar' : 'calendar-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t('navigation.inventory'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'cube' : 'cube-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
        </Tabs>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flex: 1,
  },
});
