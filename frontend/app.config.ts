import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: '6Nations',
  slug: '6nations',
  scheme: 'sixnations',
  version: '0.1.0',
  orientation: 'default',
  userInterfaceStyle: 'dark',
  plugins: ['expo-router', 'expo-font', 'expo-status-bar'],
  web: { bundler: 'metro', output: 'single', name: '6Nations · My Squad' },
  ios: { supportsTablet: true },
};

export default config;
