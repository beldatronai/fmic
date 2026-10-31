import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import LighthouseBle, { PeerRole, StateEvent } from '../modules/lighthouse-ble';
import { SignalTracker } from './signal';

export type Peer = { id: string; role: PeerRole; tracker: SignalTracker };

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

/** Advertises this phone and tracks every other Lighthouse phone in range. */
export function useBluetooth(selfId: string, role: PeerRole) {
  const peers = useRef(new Map<string, Peer>());
  const [states, setStates] = useState<StateEvent[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const peerSub = LighthouseBle.addListener('onPeer', (event) => {
      let peer = peers.current.get(event.id);
      if (!peer) {
        peer = { id: event.id, role: event.role, tracker: new SignalTracker() };
        peers.current.set(event.id, peer);
      }
      peer.tracker.add(event.rssi, event.timestamp);
    });
    const stateSub = LighthouseBle.addListener('onState', (event) => {
      setStates((prev) => [...prev.slice(-4), event]);
    });

    requestPermissions().then((granted) => {
      if (cancelled) return;
      if (granted) {
        LighthouseBle.start(selfId, role);
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
  }, [selfId, role]);

  const now = Date.now();
  const active = [...peers.current.values()].filter(
    (peer) => now - (peer.tracker.lastSeen ?? 0) < STALE_MS,
  );
  return { peers: active, states, now };
}
