import { ReactNode, useEffect, useMemo, useRef, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, type ThemeColors } from '../theme/tokens';
import { useReducedMotion } from '../lib/useReducedMotion';

export type OverlayMode = 'sheet' | 'drawer' | 'dialog';

export function OverlaySurface({ visible, mode = 'sheet', title, onClose, children, returnFocusRef }: { visible: boolean; mode?: OverlayMode; title?: string; onClose: () => void; children: ReactNode; returnFocusRef?: RefObject<any> }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const mobile = width < 768;
  const sheet = mobile || mode === 'sheet';
  const reducedMotion = useReducedMotion();
  const closeRef = useRef<any>(null);
  const surfaceRef = useRef<any>(null);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      closeRef.current?.focus?.();
      const node = findNodeHandle(closeRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 40);
    return () => clearTimeout(timer);
  }, [visible]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = surfaceRef.current as HTMLElement | null;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>('button,a,input,textarea,select,[tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [visible, onClose, reducedMotion]);
  const close = () => {
    onClose();
    setTimeout(() => returnFocusRef?.current?.focus?.(), reducedMotion ? 0 : 220);
  };
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : sheet ? 'slide' : 'fade'} onRequestClose={close}>
      <View style={[styles.backdrop, sheet && styles.backdropSheet]}>
        <View
          ref={surfaceRef}
          accessibilityLabel={title ?? 'Dialog'}
          accessibilityViewIsModal
          style={[styles.surface, sheet && styles.surfaceSheet, mode === 'drawer' && !mobile && styles.surfaceDrawer, mode === 'dialog' && styles.surfaceDialog]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>{title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}</View>
            <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel={title ? `Close ${title}` : 'Close panel'} accessibilityHint="Dismisses this panel" onPress={close} style={styles.close}>
              <Feather name="x" size={19} color={c.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: c.backdrop },
  backdropSheet: { padding: 0, justifyContent: 'flex-end', alignItems: 'stretch' },
  surface: { width: '100%', maxWidth: 620, maxHeight: '90%', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, shadowColor: c.shadow, shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, overflow: 'hidden' },
  surfaceSheet: { maxWidth: '100%', maxHeight: '92%', borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  surfaceDrawer: { alignSelf: 'stretch', maxWidth: 480, minHeight: '100%', maxHeight: '100%', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  surfaceDialog: { maxWidth: 440 },
  header: { minHeight: 64, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised },
  body: { padding: 20, gap: 14 },
});
