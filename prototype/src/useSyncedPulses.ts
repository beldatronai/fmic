import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { DOUBLE_GAP_MS, nextPulseAt, PULSES, PulseStrength } from './pulse';

const STYLE: Record<PulseStrength, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

/** Vibrates in the shared pattern for a closeness level, in step with the other phone. */
export function useSyncedPulses(level: number | null, enabled: boolean) {
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let second: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const current = levelRef.current;
      // With nobody in range, check again each second without buzzing.
      const interval = current === null ? 1000 : PULSES[current].intervalMs;
      const now = Date.now();
      timer = setTimeout(() => {
        const lvl = levelRef.current;
        if (lvl !== null) {
          const pulse = PULSES[lvl];
          Haptics.impactAsync(STYLE[pulse.strength]);
          if (pulse.double) second = setTimeout(() => Haptics.impactAsync(STYLE[pulse.strength]), DOUBLE_GAP_MS);
        }
        schedule();
      }, nextPulseAt(now, interval) - now);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      if (second) clearTimeout(second);
    };
  }, [enabled]);
}
