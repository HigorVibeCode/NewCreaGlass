import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to production screen as the default home screen
  return <Redirect href="/(tabs)/production" />;
}
