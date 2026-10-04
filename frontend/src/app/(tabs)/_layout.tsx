import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, sceneStyle: { backgroundColor: colors.bg } }} />;
}
