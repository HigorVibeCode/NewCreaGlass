import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGuard } from '@/src/components/shared/AuthGuard';
import { I18nProvider } from '@/src/providers/I18nProvider';
import { QueryProvider } from '@/src/providers/QueryProvider';
import { ThemeProvider } from '@/src/providers/ThemeProvider';

// Remove anchor to let AuthGuard control initial navigation
// export const unstable_settings = {
//   anchor: '(tabs)',
// };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <QueryProvider>
          <ThemeProvider>
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
                    headerShown: false,
                  }} 
                />
                <Stack.Screen 
                  name="event-create" 
                  options={{ 
                    presentation: 'modal',
                    title: 'Create Event',
                    animation: 'slide_from_bottom',
                    headerShown: false,
                  }} 
                />
                <Stack.Screen 
                  name="event-report-create" 
                  options={{ 
                    presentation: 'modal',
                    title: 'Create Report',
                    animation: 'slide_from_bottom',
                    headerShown: false,
                  }} 
                />
                <Stack.Screen 
                  name="documents-category" 
                  options={{ 
                    presentation: 'card',
                    title: 'Category',
                    animation: 'slide_from_right',
                    headerShown: false,
                  }} 
                />
                <Stack.Screen 
                  name="maintenance-list" 
                  options={{ 
                    presentation: 'card',
                    title: 'Maintenance',
                    animation: 'slide_from_right',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="maintenance-create" 
                  options={{ 
                    presentation: 'modal',
                    title: 'Create Maintenance',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                  }} 
                />
                <Stack.Screen 
                  name="maintenance-detail" 
                  options={{ 
                    presentation: 'card',
                    title: 'Maintenance Details',
                    animation: 'slide_from_right',
                    headerShown: true,
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
