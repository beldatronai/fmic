import { NativeModule, requireNativeModule } from 'expo';

export type PeerRole = 'L' | 'S';

export type PeerEvent = {
  id: string;
  role: PeerRole;
  rssi: number;
  timestamp: number;
};

export type StateEvent = {
  state: 'scanning' | 'advertising' | 'poweredOff' | 'unauthorized' | 'unsupported' | 'resetting' | 'unknown' | 'error';
  message: string | null;
};

type LighthouseBleEvents = {
  onPeer: (event: PeerEvent) => void;
  onState: (event: StateEvent) => void;
};

declare class LighthouseBleModule extends NativeModule<LighthouseBleEvents> {
  /** Starts advertising this phone (role + id) and scanning for other Lighthouse phones. */
  start(selfId: string, role: PeerRole): void;
  stop(): void;
}

export default requireNativeModule<LighthouseBleModule>('LighthouseBle');
