import { StyleSheet, View } from 'react-native';
import { Sample } from './signal';

const MIN_RSSI = -100;
const MAX_RSSI = -40;
const BUCKETS = 40;

/** Last 30 s of smoothed signal as bars; taller means stronger. */
export function Sparkline({ samples, now, colour }: { samples: Sample[]; now: number; colour: string }) {
  const span = 30000;
  const bucketMs = span / BUCKETS;
  const bars: (number | null)[] = Array.from({ length: BUCKETS }, () => null);
  for (const s of samples) {
    const i = Math.floor((s.t - (now - span)) / bucketMs);
    if (i >= 0 && i < BUCKETS) bars[i] = s.smooth;
  }
  return (
    <View style={styles.row}>
      {bars.map((value, i) => {
        const height =
          value === null ? 0 : Math.max(2, ((value - MIN_RSSI) / (MAX_RSSI - MIN_RSSI)) * 60);
        return <View key={i} style={[styles.bar, { height, backgroundColor: colour }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 2 },
  bar: { flex: 1, borderRadius: 1 },
});
