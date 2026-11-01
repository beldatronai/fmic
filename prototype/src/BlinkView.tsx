import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colour, Rhythm } from './beacon';

type Props = { colour: Colour; rhythm: Rhythm; label: string; onClose: () => void };

/** Full-screen colour blinking in the phone's rhythm. Tap anywhere to stop. */
export function BlinkView({ colour, rhythm, label, onClose }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(
      () => setStep((s) => (s + 1) % rhythm.steps.length),
      rhythm.steps[step].ms,
    );
    return () => clearTimeout(timer);
  }, [step, rhythm]);

  const on = rhythm.steps[step].on;
  return (
    <Pressable
      style={[styles.fill, { backgroundColor: on ? colour.hex : '#000' }]}
      onPress={onClose}
    >
      <View style={styles.footer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>Tap to stop</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  footer: { padding: 32, alignItems: 'center' },
  label: { color: '#fff', fontSize: 28, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 6 },
  hint: { color: '#fff', fontSize: 14, marginTop: 8, opacity: 0.8 },
});
