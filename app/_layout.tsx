import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { QueryProvider } from '@/src/providers/QueryProvider';
import { I18nProvider } from '@/src/providers/I18nProvider';
import { ThemeProvider } from '@/src/providers/ThemeProvider';
import { AuthGuard } from '@/src/components/shared/AuthGuard';
import { NotificationAudioInitializer } from '@/src/components/shared/NotificationAudioInitializer';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <QueryProvider>
          <ThemeProvider>
            <NotificationAudioInitializer />
            <AuthGuard>
              <Stack
                screenOptions={{
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              >
                <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen 
                  name="profile" 
                  options={{ 
                    presentation: 'modal', 
                    title: 'Profile',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="settings" 
                  options={{ 
                    presentation: 'modal', 
                    title: 'Settings',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="access-controls" 
                  options={{ 
                    presentation: 'modal', 
                    title: 'Access Controls',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="blood-priority" 
                  options={{ 
                    presentation: 'modal', 
                    title: 'Blood Priority',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="blood-priority-create" 
                  options={{ 
                    presentation: 'modal', 
                    title: 'Create Message',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="notifications" 
                  options={{ 
                    presentation: 'modal', 
                    title: 'Notifications',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="inventory-group" 
                  options={{ 
                    presentation: 'card',
                    title: 'Inventory Group',
                    animation: 'slide_from_right',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="inventory-stock-count" 
                  options={{ 
                    presentation: 'card',
                    title: 'Stock Count',
                    animation: 'slide_from_right',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="production-create" 
                  options={{ 
                    presentation: 'modal',
                    title: 'Create Order',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="production-detail" 
                  options={{ 
                    presentation: 'card',
                    title: 'Order Details',
                    animation: 'slide_from_right',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="documents-category" 
                  options={{ 
                    presentation: 'card',
                    title: 'Documents',
                    animation: 'slide_from_right',
                    headerShown: false,
                  }} 
                />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
            </AuthGuard>
          </ThemeProvider>
        </QueryProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
