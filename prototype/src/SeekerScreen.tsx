import * as Clipboard from 'expo-clipboard';
import { useKeepAwake } from 'expo-keep-awake';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colourFor, rhythmFor } from './beacon';
import { BlinkView } from './BlinkView';
import { Calibrate } from './Calibrate';
import { styles } from './styles';
import { band, Calibration, formatMetres, levelFor, levelRange, metresFor } from './signal';
import { Sparkline } from './Sparkline';
import { useBluetooth } from './useBluetooth';
import { useSyncedPulses } from './useSyncedPulses';

type Props = {
  selfId: string;
  group: string;
  calibration: Calibration;
  onCalibrate: (cal: Calibration) => void;
  onExit: () => void;
};

const TREND_LABEL = { warmer: 'Warmer ↑', colder: 'Colder ↓', steady: 'Steady' } as const;

/** The phone looking for the Lighthouse: signal trend, distance and synced haptic pulses. */
export function SeekerScreen({ selfId, group, calibration, onCalibrate, onExit }: Props) {
  useKeepAwake();
  const [pulses, setPulses] = useState(true);
  const [found, setFound] = useState(false);
  const [blinking, setBlinking] = useState(false);

  // The closeness level is measured here and broadcast, so the Lighthouse buzzes in the same
  // pattern. It is computed from the previous render's data, which is at most 250 ms old.
  const levelRef = useRef<number | null>(null);
  const { peers, states, now } = useBluetooth(selfId, group, 'S', levelRef.current);

  const lighthouses = peers
    .filter((p) => p.role === 'L')
    .sort((a, b) => (b.tracker.level ?? -999) - (a.tracker.level ?? -999));
  const target = lighthouses[0];
  const rssi = target?.tracker.level ?? null;
  const level = rssi === null ? null : levelFor(rssi, calibration, levelRef.current);
  levelRef.current = level;

  useSyncedPulses(level, pulses && !found);

  const colour = colourFor(group);
  const rhythm = rhythmFor(group);

  if (blinking) {
    return <BlinkView colour={colour} rhythm={rhythm} label={`Group ${group}`} onClose={() => setBlinking(false)} />;
  }

  const copyLog = () => {
    if (!target) return;
    const rows = target.tracker.samples.map((s) => `${s.t},${s.raw},${s.smooth.toFixed(1)}`);
    Clipboard.setStringAsync(
      [`# calibration ${calibration.rssiTogether} dBm together`, 'time_ms,rssi_raw,rssi_smooth', ...rows].join('\n'),
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Finding the Lighthouse</Text>
      <Text style={styles.muted}>
        Group {group} · you are {selfId} · {states.map((s) => s.state).join(' · ') || 'starting…'}
      </Text>
      <View style={styles.identity}>
        <View style={[styles.swatch, { backgroundColor: colour.hex }]} />
        <Text style={styles.body}>
          Look for {colour.name}, {rhythm.name}
        </Text>
      </View>

      {!target && <Text style={styles.body}>No Lighthouse from group {group} in range yet. Keep this screen open.</Text>}

      {target && rssi !== null && level !== null && (
        <>
          <Text style={[styles.title, { fontSize: 44 }]}>
            {found ? 'Found!' : TREND_LABEL[target.tracker.trend(now)]}
          </Text>
          <Text style={styles.body}>
            {band(level)}, about {formatMetres(metresFor(rssi, calibration))} · level {level} of 9 ({levelRange(level)})
          </Text>
          <Text style={styles.muted}>{rssi.toFixed(0)} dBm</Text>
          <Sparkline samples={target.tracker.samples} now={now} colour={colour.hex} />
          <Text style={styles.muted}>Signal over the last 30 seconds. Taller is closer.</Text>
        </>
      )}

      <Calibrate samples={target?.tracker.samples ?? null} now={now} calibration={calibration} onCalibrate={onCalibrate} />

      <View style={styles.row}>
        <Pressable style={styles.small} onPress={() => setFound((f) => !f)}>
          <Text>{found ? 'Keep searching' : 'Found'}</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={() => setPulses((p) => !p)}>
          <Text>Vibration {pulses ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={() => setBlinking(true)}>
          <Text>Blink my screen</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={copyLog}>
          <Text>Copy signal log</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={onExit}>
          <Text>Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
