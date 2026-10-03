import { Tabs } from 'expo-router';
import { colors } from '../../theme/tokens';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, sceneStyle: { backgroundColor: colors.bg } }} />;
}
