import { AccessibilityInfo, Platform } from 'react-native';
import { useEffect, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => mounted && setReduced(query.matches);
      update();
      query.addEventListener?.('change', update);
      return () => {
        mounted = false;
        query.removeEventListener?.('change', update);
      };
    }
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    }).catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
