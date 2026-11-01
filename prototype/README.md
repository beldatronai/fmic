# Lighthouse prototype

Two-phone test of the riskiest part of Lighthouse: can a phone tell, from Bluetooth alone,
whether it is getting closer to another phone, and can the other phone light up its screen
in a recognisable colour and rhythm when that happens?

## What it does

- **Be the Lighthouse:** the phone broadcasts over Bluetooth, lists seekers in range, and buzzes
  with "Someone is close. Hold your phone up!" once a seeker's signal passes a threshold
  (default -75 dBm, adjustable with Further / Closer). "Start blinking" fills the screen with
  the phone's colour in its rhythm.
- **Find the Lighthouse:** the phone shows *Warmer / Colder / Steady*, a distance band, a very
  rough distance in metres, a 30-second signal chart, and vibrates faster as you get closer.
  It also says which colour and rhythm to look for. Both phones work this out from the
  Bluetooth id, so no internet is needed.
- **Copy signal log:** copies the raw and smoothed signal as CSV, for calibrating thresholds.

Both phones broadcast and scan at the same time, which is how the Lighthouse knows a seeker is close.

## Running it

It uses a custom native module (`modules/lighthouse-ble`), so it cannot run in Expo Go.
You need to build the app and install it on two real phones (Bluetooth does not work in simulators).
**Step-by-step instructions for Android and iPhone are in [BUILDING.md](BUILDING.md).**

## Test plan

1. Phone A: **Be the Lighthouse**. Phone B: **Find the Lighthouse**. Keep both screens on.
2. Start about 40 m apart outdoors. Walk B towards A slowly, then away. Note when the trend
   flips and when A asks to be held up.
3. Repeat with phones in pockets, and with people between the phones.
4. Try iPhone to Android in both directions.
5. After each walk, use **Copy signal log** on B and save the CSV, so we can tune the smoothing,
   the trend sensitivity and the alert threshold.

## Known limits

- Both apps must be open in the foreground. Background mode comes later.
- Screen blink only; the camera flash is not wired in yet.
- Distances use a generic model (-59 dBm at 1 m) and need calibrating per phone model.
- The native Bluetooth code (Swift and Kotlin) was written but not compiled or run in the
  environment it was made in. The TypeScript logic is type-checked and unit-tested
  (`npm test`, `npm run typecheck`).

## Layout

- `modules/lighthouse-ble/`: native Bluetooth advertising and scanning (Swift and Kotlin).
- `src/signal.ts`: Kalman smoothing, warmer/colder trend, distance bands, haptic pace.
- `src/beacon.ts`: ids, colours and blink rhythms (all under 3 flashes per second).
- `src/LighthouseScreen.tsx`, `src/SeekerScreen.tsx`: the two modes.
