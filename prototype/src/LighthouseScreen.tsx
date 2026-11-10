import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colourFor, rhythmFor } from './beacon';
import { BlinkView } from './BlinkView';
import { Calibrate } from './Calibrate';
import { band, Calibration, levelFor, levelRange, MAX_LEVEL } from './signal';
import { styles } from './styles';
import { Peer, useBluetooth } from './useBluetooth';
import { useSyncedPulses } from './useSyncedPulses';

type Props = {
  selfId: string;
  group: string;
  calibration: Calibration;
  onCalibrate: (cal: Calibration) => void;
  onExit: () => void;
};

/**
 * The phone that stays put. Vibrates in the same pattern as the seeker as it gets closer, and
 * asks its owner to raise it when the seeker is near.
 */
export function LighthouseScreen({ selfId, group, calibration, onCalibrate, onExit }: Props) {
  useKeepAwake();
  const { peers, states, now } = useBluetooth(selfId, group, 'L');
  const colour = colourFor(group);
  const rhythm = rhythmFor(group);
  const [alertLevel, setAlertLevel] = useState(5); // 2.5-3.5 m
  const [pulses, setPulses] = useState(true);
  const [blinking, setBlinking] = useState(false);
  // Seekers already announced, so the "hold it up" alert fires once per approach.
  const announced = useRef(new Set<string>());

  // Prefer the level the seeker broadcasts, so both phones buzz the same. Fall back to this
  // phone's own reading if the seeker's level hasn't arrived.
  const levelOf = (p: Peer): number | null =>
    p.level ?? (p.tracker.level === null ? null : levelFor(p.tracker.level, calibration));

  const seekers = peers.filter((p) => p.role === 'S');
  const levels = seekers.map(levelOf).filter((l): l is number => l !== null);
  const nearest = levels.length > 0 ? Math.max(...levels) : null;
  const close = seekers.filter((p) => (levelOf(p) ?? -1) >= alertLevel);

  useSyncedPulses(nearest, pulses);

  useEffect(() => {
    for (const seeker of close) {
      if (!announced.current.has(seeker.id)) {
        announced.current.add(seeker.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
    // Forget seekers that walked clearly back out (one level of hysteresis), so a second
    // approach alerts again.
    for (const id of announced.current) {
      const seeker = seekers.find((s) => s.id === id);
      if (!seeker || (levelOf(seeker) ?? -1) < alertLevel - 1) announced.current.delete(id);
    }
  });

  if (blinking) {
    return <BlinkView colour={colour} rhythm={rhythm} label={`Group ${group}`} onClose={() => setBlinking(false)} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Lighthouse · group {group}</Text>
      <View style={styles.identity}>
        <View style={[styles.swatch, { backgroundColor: colour.hex }]} />
        <Text style={styles.body}>
          {colour.name}, {rhythm.name}
        </Text>
      </View>
      <Text style={styles.muted}>
        You are {selfId} · {states.map((s) => s.state).join(' · ') || 'starting…'}
      </Text>

      {close.length > 0 && (
        <View style={[styles.alert, { borderColor: colour.hex }]}>
          <Text style={styles.alertTitle}>Someone is close. Hold your phone up!</Text>
          <Pressable style={[styles.button, { backgroundColor: colour.hex }]} onPress={() => setBlinking(true)}>
            <Text style={styles.buttonText}>Start blinking</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.section}>Seekers in range</Text>
      {seekers.length === 0 && <Text style={styles.muted}>Nobody from group {group} yet.</Text>}
      {seekers.map((s) => {
        const level = levelOf(s);
        return (
          <Text key={s.id} style={styles.body}>
            {s.id}:{' '}
            {level === null
              ? 'measuring…'
              : `${band(level)}, ${levelRange(level)} (level ${level}${s.level === null ? ', own reading' : ''})`}
            {s.tracker.level !== null && ` · ${s.tracker.level.toFixed(0)} dBm`}
          </Text>
        );
      })}

      <Text style={styles.section}>Ask to hold up at {levelRange(alertLevel)} or closer</Text>
      <View style={styles.row}>
        <Pressable style={styles.small} onPress={() => setAlertLevel((l) => Math.max(1, l - 1))}>
          <Text>Further</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={() => setAlertLevel((l) => Math.min(MAX_LEVEL, l + 1))}>
          <Text>Closer</Text>
        </Pressable>
      </View>

      <Calibrate
        samples={seekers[0]?.tracker.samples ?? null}
        now={now}
        calibration={calibration}
        onCalibrate={onCalibrate}
      />
      <Text style={styles.muted}>
        Calibrating here only matters if the seeker's level isn't coming through; the seeker's calibration
        drives both phones.
      </Text>

      <View style={styles.row}>
        <Pressable style={styles.small} onPress={() => setPulses((p) => !p)}>
          <Text>Vibration {pulses ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={() => setBlinking(true)}>
          <Text>Blink now</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={onExit}>
          <Text>Stop Lighthouse</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
