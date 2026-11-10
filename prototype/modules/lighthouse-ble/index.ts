import { NativeModule, requireNativeModule } from 'expo';

export type PeerEvent = {
  /** The other phone's broadcast text; see src/protocol.ts. */
  payload: string;
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
  /** Starts advertising `payload` and scanning for other Lighthouse phones. */
  start(payload: string): void;
  /** Changes what this phone advertises without stopping the scan. */
  setPayload(payload: string): void;
  stop(): void;
}

export default requireNativeModule<LighthouseBleModule>('LighthouseBle');
