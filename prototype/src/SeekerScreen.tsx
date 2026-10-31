import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colourFor, rhythmFor } from './beacon';
import { BlinkView } from './BlinkView';
import { styles } from './styles';
import { band, pulseIntervalMs, roughMetres } from './signal';
import { Sparkline } from './Sparkline';
import { useBluetooth } from './useBluetooth';

type Props = { selfId: string; onExit: () => void };

const TREND_LABEL = { warmer: 'Warmer ↑', colder: 'Colder ↓', steady: 'Steady' } as const;

/** The phone looking for the Lighthouse: signal trend, distance band and haptic pulses. */
export function SeekerScreen({ selfId, onExit }: Props) {
  useKeepAwake();
  const { peers, states, now } = useBluetooth(selfId, 'S');
  const [pulses, setPulses] = useState(true);
  const [found, setFound] = useState(false);
  const [blinking, setBlinking] = useState(false);

  const lighthouses = peers
    .filter((p) => p.role === 'L')
    .sort((a, b) => (b.tracker.level ?? -999) - (a.tracker.level ?? -999));
  const target = lighthouses[0];
  const level = target?.tracker.level ?? null;

  // Haptic pulses speed up as the signal gets stronger.
  const levelRef = useRef(level);
  levelRef.current = level;
  useEffect(() => {
    if (!pulses || found) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = levelRef.current;
      if (current !== null) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timer = setTimeout(tick, current === null ? 1000 : pulseIntervalMs(current));
    };
    tick();
    return () => clearTimeout(timer);
  }, [pulses, found]);

  if (blinking) {
    return (
      <BlinkView
        colour={colourFor(selfId)}
        rhythm={rhythmFor(selfId)}
        label={`Seeker ${selfId}`}
        onClose={() => setBlinking(false)}
      />
    );
  }

  const copyLog = () => {
    if (!target) return;
    const rows = target.tracker.samples.map((s) => `${s.t},${s.raw},${s.smooth.toFixed(1)}`);
    Clipboard.setStringAsync(['time_ms,rssi_raw,rssi_smooth', ...rows].join('\n'));
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Finding the Lighthouse</Text>
      <Text style={styles.muted}>
        You are {selfId} · {states.map((s) => s.state).join(' · ') || 'starting…'}
      </Text>

      {!target && <Text style={styles.body}>No Lighthouse in range yet. Keep this screen open.</Text>}

      {target && level !== null && (
        <>
          <View style={styles.identity}>
            <View style={[styles.swatch, { backgroundColor: colourFor(target.id).hex }]} />
            <Text style={styles.body}>
              Look for {colourFor(target.id).name}, {rhythmFor(target.id).name} (Lighthouse {target.id})
            </Text>
          </View>
          <Text style={[styles.title, { fontSize: 44 }]}>
            {found ? 'Found!' : TREND_LABEL[target.tracker.trend(now)]}
          </Text>
          <Text style={styles.body}>
            {band(level)}, about {roughMetres(level).toFixed(0)} m (rough) · {level.toFixed(0)} dBm
          </Text>
          <Sparkline samples={target.tracker.samples} now={now} colour={colourFor(target.id).hex} />
          <Text style={styles.muted}>Signal over the last 30 seconds. Taller is closer.</Text>
        </>
      )}

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
