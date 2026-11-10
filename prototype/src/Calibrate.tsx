import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calibration, calibrateFrom, DEFAULT_CALIBRATION, Sample } from './signal';
import { styles } from './styles';

type Props = {
  samples: readonly Sample[] | null;
  now: number;
  calibration: Calibration;
  onCalibrate: (cal: Calibration) => void;
};

/** "Hold the phones together and tap Calibrate": records what this pair reads at ~5 cm. */
export function Calibrate({ samples, now, calibration, onCalibrate }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const calibrated = calibration !== DEFAULT_CALIBRATION;

  const run = () => {
    const cal = samples ? calibrateFrom(samples, now) : null;
    if (!cal) {
      setMessage('Not enough signal yet. Keep the phones together for a few seconds and try again.');
      return;
    }
    onCalibrate(cal);
    setMessage(`Calibrated: ${cal.rssiTogether} dBm when together.`);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.muted}>
        {calibrated
          ? `Calibrated at ${calibration.rssiTogether} dBm together.`
          : 'Not calibrated: distances are a guess. Hold both phones side by side, then tap Calibrate.'}
      </Text>
      <Pressable style={styles.small} onPress={run}>
        <Text>Calibrate (phones together)</Text>
      </Pressable>
      {message && <Text style={styles.muted}>{message}</Text>}
    </View>
  );
}
