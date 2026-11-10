# Lighthouse prototype

Two-phone test of the riskiest part of Lighthouse: can a phone tell, from Bluetooth alone,
whether it is getting closer to another phone, and can the other phone light up its screen
in a recognisable colour and rhythm when that happens?

## What it does

- **Groups:** one phone taps **Start a group** and gets a 4-character code (e.g. `K7PQ`).
  **Share group** sends a message with the code and a `lighthouseproto://join/K7PQ` link. The
  other phone opens the link or types the code under **Join**. Phones only react to members of
  their own group, and the code sets the group's colour and blink rhythm.
- **Be the Lighthouse:** the phone broadcasts over Bluetooth, lists seekers in its group, vibrates
  as a seeker gets closer, and shows "Someone is close. Hold your phone up!" once a seeker is
  within the alert range (default 2.5-3.5 m, adjustable with Further / Closer). "Start blinking"
  fills the screen with the group's colour in its rhythm.
- **Find the Lighthouse:** the phone shows *Warmer / Colder / Steady*, a distance estimate, a
  closeness level from 0 to 9, a 30-second signal chart, and vibrates faster as you get closer.
- **Synced vibration:** the seeker measures the closeness level and broadcasts it. The Lighthouse
  uses that same level, so both phones vibrate in the same pattern (`src/pulse.ts`), and each
  pulse is fired on the same clock boundary so they buzz together.
- **Calibrate:** hold the two phones side by side and tap **Calibrate**. Distances are measured
  relative to that reading, because phones differ by 20-30 dB. Do it on the seeker; its
  calibration drives both phones.
- **Copy signal log:** copies the raw and smoothed signal as CSV, for tuning.

Both phones broadcast and scan at the same time, which is how the Lighthouse knows a seeker is close.

### Buzz pace by distance

| Level | Distance | Pulse every |
| --- | --- | --- |
| 0 | over 20 m | 2.0 s, light |
| 1 | 12-20 m | 1.4 s, light |
| 2 | 8-12 m | 1.0 s |
| 3 | 5-8 m | 0.8 s |
| 4 | 3.5-5 m | 0.65 s |
| 5 | 2.5-3.5 m | 0.56 s, strong |
| 6 | 1.8-2.5 m | 0.5 s, strong |
| 7 | 1.2-1.8 m | 0.45 s, strong |
| 8 | 0.6-1.2 m | 0.4 s, strong double |
| 9 | under 0.6 m | 0.35 s, strong double |

The pace jumps quickly in the first levels, then changes in small steps over the last few metres.

## Running it

It uses a custom native module (`modules/lighthouse-ble`), so it cannot run in Expo Go.
You need to build the app and install it on two real phones (Bluetooth does not work in simulators).
**Step-by-step instructions for Android and iPhone are in [BUILDING.md](BUILDING.md).**

## Test plan

1. Phone A: **Start a group** and share it. Phone B: join it. Hold the phones together, open
   **Find the Lighthouse** on B and **Be the Lighthouse** on A, and tap **Calibrate** on B.
   Keep both screens on.
2. Start about 40 m apart outdoors. Walk B towards A slowly, then away. Note when the trend
   flips and when A asks to be held up.
3. Repeat with phones in pockets, and with people between the phones.
4. Try iPhone to Android in both directions.
5. After each walk, use **Copy signal log** on B and save the CSV, so we can tune the smoothing,
   the trend sensitivity and the alert threshold.

## Known limits

- Both apps must be open in the foreground. Background mode comes later.
- Screen blink only; the camera flash is not wired in yet.
- Distances are only as good as the calibration, and bodies and pockets still swing the signal
  by 10 dB or more. Calibration is not saved between app launches yet.
- Pulses line up only as well as the two phones' clocks agree (usually within tens of ms).
- No QR code yet; sharing is by code or link. Links with a custom scheme are not clickable in
  every chat app, which is why the message includes the code too.
- The native Bluetooth code (Swift and Kotlin) was written but not compiled or run in the
  environment it was made in. The TypeScript logic is type-checked and unit-tested
  (`npm test`, `npm run typecheck`).

## Layout

- `modules/lighthouse-ble/`: native Bluetooth advertising and scanning (Swift and Kotlin).
- `src/signal.ts`: Kalman smoothing, warmer/colder trend, calibration, distance and closeness levels.
- `src/pulse.ts`, `src/useSyncedPulses.ts`: the shared vibration pattern and clock-aligned pulses.
- `src/protocol.ts`: what each phone broadcasts (role, group, id, closeness level).
- `src/group.ts`: group codes and join links.
- `src/beacon.ts`: ids, colours and blink rhythms (all under 3 flashes per second).
- `src/LighthouseScreen.tsx`, `src/SeekerScreen.tsx`: the two modes.
