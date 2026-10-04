import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, View } from 'react-native';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, colors, toggleTheme } = useTheme();
  // Avoid motion until the device preference has been resolved.
  const [reduceMotion, setReduceMotion] = useState(true);
  const iconProgress = useRef(new Animated.Value(1)).current;
  const previousTheme = useRef(theme);
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const themeChanged = previousTheme.current !== theme;
    previousTheme.current = theme;
    iconProgress.stopAnimation();
    if (Platform.OS === 'web' || reduceMotion || !themeChanged) {
      iconProgress.setValue(1);
      return;
    }
    iconProgress.setValue(0);
    const animation = Animated.timing(iconProgress, {
      toValue: 1,
      duration: 190,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [theme, reduceMotion, iconProgress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`Current theme: ${theme}`}
      onPress={toggleTheme}
      {...(Platform.OS === 'web' ? { title: label } : {})}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        backgroundColor: pressed ? colors.elevated : 'transparent',
      })}
    >
      <View style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.active,
      }}>
        <Animated.View style={{
          opacity: iconProgress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: iconProgress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        }}>
          <Feather name={theme === 'dark' ? 'moon' : 'sun'} size={17} color={colors.emerald} />
        </Animated.View>
      </View>
    </Pressable>
  );
}
