import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export function Label({
  children,
  muted = false,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Text style={[styles.label, muted && { color: colors.muted }]}>{children}</Text>
    </View>
  );
}

export const Button = forwardRef<ComponentRef<typeof Pressable>, {
  children: ReactNode;
  onPress: () => void;
  label?: string;
  hint?: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  compact?: boolean;
}>(({
  children,
  onPress,
  label,
  hint,
  variant = 'outline',
  disabled = false,
  loading = false,
  selected = false,
  compact = false,
}, ref) => {
  const unavailable = disabled || loading;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label ?? (typeof children === 'string' ? children : undefined)}
      accessibilityHint={hint}
      accessibilityState={{ disabled: unavailable, selected, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && { borderColor: colors.danger },
        selected && styles.selected,
        unavailable && { opacity: 0.4 },
        pressed && !unavailable && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && { color: colors.bg },
          variant === 'danger' && { color: colors.danger },
          selected && variant !== 'primary' && { color: colors.bg },
        ]}
      >
        {loading ? 'Loading…' : children}
      </Text>
    </Pressable>
  );
});
Button.displayName = 'Button';

export const styles = StyleSheet.create({
  label: { fontFamily: fonts.body, color: colors.text, fontSize: 14, lineHeight: 22 },
  button: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  compact: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 8 },
  primary: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  ghost: { borderColor: 'transparent', backgroundColor: 'transparent' },
  selected: { borderColor: colors.text, backgroundColor: colors.text },
  buttonText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
});
