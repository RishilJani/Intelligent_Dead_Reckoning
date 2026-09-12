import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/services/authContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false, freezeOnBlur: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="profile" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="feedback" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="favourites" options={{ headerShown: false, animation: 'slide_from_right' }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
