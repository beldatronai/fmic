import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { colourFor, randomId, rhythmFor } from './src/beacon';
import { newGroupCode, parseGroupCode, shareMessage } from './src/group';
import { LighthouseScreen } from './src/LighthouseScreen';
import { SeekerScreen } from './src/SeekerScreen';
import { Calibration, DEFAULT_CALIBRATION } from './src/signal';
import { styles } from './src/styles';

type Mode = 'home' | 'lighthouse' | 'seeker';

export default function App() {
  // A new id per app launch; good enough for a prototype.
  const [selfId] = useState(() => randomId());
  const [mode, setMode] = useState<Mode>('home');
  const [group, setGroup] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [joinError, setJoinError] = useState(false);
  // Kept for the whole session so switching screens doesn't lose it.
  const [calibration, setCalibration] = useState<Calibration>(DEFAULT_CALIBRATION);
  const home = () => setMode('home');

  // Opening a join link (lighthouseproto://join/CODE) puts this phone in that group.
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      const code = url ? parseGroupCode(url) : null;
      if (code) {
        setGroup(code);
        setMode('home');
      }
    };
    Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener('url', (event) => open(event.url));
    return () => sub.remove();
  }, []);

  const join = () => {
    const code = parseGroupCode(typed);
    setJoinError(!code);
    if (code) setGroup(code);
  };

  const shared = { selfId, calibration, onCalibrate: setCalibration, onExit: home };

  return (
    <>
      <StatusBar style="auto" />
      {mode === 'lighthouse' && group && <LighthouseScreen group={group} {...shared} />}
      {mode === 'seeker' && group && <SeekerScreen group={group} {...shared} />}
      {mode === 'home' && !group && (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.title}>Lighthouse prototype</Text>
          <Text style={styles.body}>
            Start a group on one phone and share it with the other, so the two phones only look for each other.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: '#FFD600' }]}
            onPress={() => setGroup(newGroupCode())}
          >
            <Text style={styles.buttonText}>Start a group</Text>
          </Pressable>

          <Text style={styles.section}>Or join one</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.small, styles.codeInput]}
              value={typed}
              onChangeText={(t) => {
                setTyped(t);
                setJoinError(false);
              }}
              placeholder="Code, e.g. K7PQ"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={40}
              onSubmitEditing={join}
            />
            <Pressable style={styles.small} onPress={join}>
              <Text>Join</Text>
            </Pressable>
          </View>
          {joinError && <Text style={styles.muted}>That doesn't look like a group code (4 letters and numbers).</Text>}
          <Text style={styles.muted}>Opening a shared join link also joins the group.</Text>
        </ScrollView>
      )}
      {mode === 'home' && group && (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.muted}>Group</Text>
          <Text style={styles.code}>{group}</Text>
          <View style={styles.identity}>
            <View style={[styles.swatch, { backgroundColor: colourFor(group).hex }]} />
            <Text style={styles.body}>
              Signal: {colourFor(group).name}, {rhythmFor(group).name}
            </Text>
          </View>
          <Pressable style={styles.small} onPress={() => Share.share({ message: shareMessage(group) })}>
            <Text>Share group</Text>
          </Pressable>
          <Text style={styles.muted}>
            The other phone opens the link or types {group} under "Join". Then pick one role on each phone.
          </Text>

          <Pressable style={[styles.button, { backgroundColor: '#FFD600' }]} onPress={() => setMode('lighthouse')}>
            <Text style={styles.buttonText}>Be the Lighthouse</Text>
          </Pressable>
          <Pressable style={[styles.button, { backgroundColor: '#00E5FF' }]} onPress={() => setMode('seeker')}>
            <Text style={styles.buttonText}>Find the Lighthouse</Text>
          </Pressable>
          <Text style={styles.muted}>
            This phone is {selfId}. Both need Bluetooth on and this app open. Calibrate once with the phones
            held together for good distances.
          </Text>
          <Pressable
            style={styles.small}
            onPress={() => {
              setGroup(null);
              setCalibration(DEFAULT_CALIBRATION);
            }}
          >
            <Text>Leave group</Text>
          </Pressable>
        </ScrollView>
      )}
    </>
  );
}
