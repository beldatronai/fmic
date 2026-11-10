import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import LighthouseBle, { StateEvent } from '../modules/lighthouse-ble';
import { decodePayload, encodePayload, Role } from './protocol';
import { SignalTracker } from './signal';

export type Peer = {
  id: string;
  role: Role;
  /** Closeness level the peer itself measured and broadcast (seekers only). */
  level: number | null;
  tracker: SignalTracker;
};

// A peer not heard from for this long is treated as gone.
const STALE_MS = 6000;

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS asks on first Bluetooth use.
  const p = PermissionsAndroid.PERMISSIONS;
  const wanted =
    Number(Platform.Version) >= 31
      ? [p.BLUETOOTH_SCAN, p.BLUETOOTH_ADVERTISE, p.BLUETOOTH_CONNECT, p.ACCESS_FINE_LOCATION]
      : [p.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((perm) => result[perm] === PermissionsAndroid.RESULTS.GRANTED);
}

/**
 * Advertises this phone and tracks the other phones in the same group. `level` is this phone's
 * own closeness reading, broadcast so the other phone can buzz in the same pattern.
 */
export function useBluetooth(selfId: string, group: string, role: Role, level: number | null = null) {
  const peers = useRef(new Map<string, Peer>());
  const [states, setStates] = useState<StateEvent[]>([]);
  const [, setTick] = useState(0);
  const payload = encodePayload({ role, group, id: selfId, level });
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    let cancelled = false;
    const peerSub = LighthouseBle.addListener('onPeer', (event) => {
      const decoded = decodePayload(event.payload);
      // Phones from other groups, and this phone's own echo, are ignored.
      if (!decoded || decoded.group !== group || decoded.id === selfId) return;
      let peer = peers.current.get(decoded.id);
      if (!peer) {
        peer = { id: decoded.id, role: decoded.role, level: null, tracker: new SignalTracker() };
        peers.current.set(decoded.id, peer);
      }
      peer.role = decoded.role;
      peer.level = decoded.level;
      peer.tracker.add(event.rssi, event.timestamp);
    });
    const stateSub = LighthouseBle.addListener('onState', (event) => {
      setStates((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.state === event.state && last.message === event.message) return prev;
        return [...prev.slice(-4), event];
      });
    });

    requestPermissions().then((granted) => {
      if (cancelled) return;
      if (granted) {
        LighthouseBle.start(payloadRef.current);
      } else {
        setStates((prev) => [...prev, { state: 'unauthorized', message: 'permissions denied' }]);
      }
    });

    // Re-render a few times a second rather than on every Bluetooth packet.
    const timer = setInterval(() => setTick((n) => n + 1), 250);

    return () => {
      cancelled = true;
      clearInterval(timer);
      peerSub.remove();
      stateSub.remove();
      LighthouseBle.stop();
      peers.current.clear();
    };
  }, [selfId, group, role]);

  // Re-advertise when the closeness level changes. Harmless before start(): native keeps it.
  useEffect(() => {
    LighthouseBle.setPayload(payload);
  }, [payload]);

  const now = Date.now();
  const active = [...peers.current.values()].filter(
    (peer) => now - (peer.tracker.lastSeen ?? 0) < STALE_MS,
  );
  return { peers: active, states, now };
}
