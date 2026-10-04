import { useFonts } from 'expo-font';
import { Chivo_700Bold } from '@expo-google-fonts/chivo/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Redirect, Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { authenticatedRedirect } from '../features/auth/routing';
import '../../global.css';

export default function Layout() {
  return <ThemeProvider><AuthProvider><ThemedLayout /></AuthProvider></ThemeProvider>;
}

function ThemedLayout() {
  const { colors, theme } = useTheme();
  const { configured, loading, session, onboardingComplete } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [loaded, error] = useFonts({ Chivo_700Bold, Inter_400Regular, Inter_600SemiBold });
  const inAuthGroup = segments[0] === '(auth)';
  const inRecovery = pathname === '/reset-password';
  const redirectTarget = configured && !loading && session && inAuthGroup && !inRecovery
    ? authenticatedRedirect(onboardingComplete)
    : null;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.emerald} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading 6Nations…</Text>
      </View>
      );
  if (configured && !loading) {
    if (!session && !inAuthGroup) return <Redirect href="/sign-in" />;
    if (redirectTarget) return null;
  }
  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}
