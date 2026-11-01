import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colourFor, randomId, rhythmFor } from './src/beacon';
import { LighthouseScreen } from './src/LighthouseScreen';
import { SeekerScreen } from './src/SeekerScreen';
import { styles } from './src/styles';

type Mode = 'home' | 'lighthouse' | 'seeker';

export default function App() {
  // A new id per app launch; good enough for a two-phone test.
  const [selfId] = useState(() => randomId());
  const [mode, setMode] = useState<Mode>('home');
  const home = () => setMode('home');

  return (
    <>
      <StatusBar style="auto" />
      {mode === 'lighthouse' && <LighthouseScreen selfId={selfId} onExit={home} />}
      {mode === 'seeker' && <SeekerScreen selfId={selfId} onExit={home} />}
      {mode === 'home' && (
        <View style={styles.page}>
          <Text style={styles.title}>Lighthouse prototype</Text>
          <View style={styles.identity}>
            <View style={[styles.swatch, { backgroundColor: colourFor(selfId).hex }]} />
            <Text style={styles.body}>
              This phone is {selfId}: {colourFor(selfId).name}, {rhythmFor(selfId).name}
            </Text>
          </View>
          <Pressable style={[styles.button, { backgroundColor: '#FFD600' }]} onPress={() => setMode('lighthouse')}>
            <Text style={styles.buttonText}>Be the Lighthouse</Text>
          </Pressable>
          <Pressable style={[styles.button, { backgroundColor: '#00E5FF' }]} onPress={() => setMode('seeker')}>
            <Text style={styles.buttonText}>Find the Lighthouse</Text>
          </Pressable>
          <Text style={styles.muted}>Use one phone as each. Both need Bluetooth on and this app open.</Text>
        </View>
      )}
    </>
  );
}
