import { useFonts } from 'expo-font';
import { Chivo_700Bold } from '@expo-google-fonts/chivo/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import '../../global.css';

export default function Layout() {
  const [loaded, error] = useFonts({ Chivo_700Bold, Inter_400Regular, Inter_600SemiBold });
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
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}
