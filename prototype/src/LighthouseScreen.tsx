import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colourFor, rhythmFor } from './beacon';
import { BlinkView } from './BlinkView';
import { band, roughMetres } from './signal';
import { styles } from './styles';
import { useBluetooth } from './useBluetooth';

type Props = { selfId: string; onExit: () => void };

/** The phone that stays put. Asks its owner to raise it when a seeker comes close. */
export function LighthouseScreen({ selfId, onExit }: Props) {
  useKeepAwake();
  const { peers, states } = useBluetooth(selfId, 'L');
  const colour = colourFor(selfId);
  const rhythm = rhythmFor(selfId);
  const [threshold, setThreshold] = useState(-75);
  const [blinking, setBlinking] = useState(false);
  // Seekers already announced, so the phone buzzes once per approach, not continuously.
  const announced = useRef(new Set<string>());

  const seekers = peers.filter((p) => p.role === 'S');
  const close = seekers.filter((p) => (p.tracker.level ?? -999) >= threshold);

  useEffect(() => {
    for (const seeker of close) {
      if (!announced.current.has(seeker.id)) {
        announced.current.add(seeker.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
    // Forget seekers that walked clearly back out (6 dB of hysteresis so a signal hovering
    // at the threshold doesn't buzz over and over), so a second approach alerts again.
    for (const id of announced.current) {
      const seeker = seekers.find((s) => s.id === id);
      if (!seeker || (seeker.tracker.level ?? -999) < threshold - 6) announced.current.delete(id);
    }
  });

  if (blinking) {
    return (
      <BlinkView
        colour={colour}
        rhythm={rhythm}
        label={`Lighthouse ${selfId}`}
        onClose={() => setBlinking(false)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Lighthouse {selfId}</Text>
      <View style={styles.identity}>
        <View style={[styles.swatch, { backgroundColor: colour.hex }]} />
        <Text style={styles.body}>
          {colour.name}, {rhythm.name}
        </Text>
      </View>
      <Text style={styles.muted}>{states.map((s) => s.state).join(' · ') || 'starting…'}</Text>

      {close.length > 0 && (
        <View style={[styles.alert, { borderColor: colour.hex }]}>
          <Text style={styles.alertTitle}>Someone is close. Hold your phone up!</Text>
          <Pressable style={[styles.button, { backgroundColor: colour.hex }]} onPress={() => setBlinking(true)}>
            <Text style={styles.buttonText}>Start blinking</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.section}>Seekers in range</Text>
      {seekers.length === 0 && <Text style={styles.muted}>Nobody yet.</Text>}
      {seekers.map((s) => {
        const level = s.tracker.level ?? 0;
        return (
          <Text key={s.id} style={styles.body}>
            {s.id}: {band(level)}, about {roughMetres(level).toFixed(0)} m ({level.toFixed(0)} dBm)
          </Text>
        );
      })}

      <Text style={styles.section}>Alert when signal is above {threshold} dBm</Text>
      <View style={styles.row}>
        <Pressable style={styles.small} onPress={() => setThreshold((t) => t - 3)}>
          <Text>Further</Text>
        </Pressable>
        <Pressable style={styles.small} onPress={() => setThreshold((t) => t + 3)}>
          <Text>Closer</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
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
