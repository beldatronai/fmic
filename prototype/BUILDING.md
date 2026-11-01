# Building and installing the prototype

The prototype has its own Bluetooth code, so it **cannot run in Expo Go**. You build a real
app and install it on two phones. Bluetooth does not work in simulators or emulators.

Pick one route per platform:

| Route | Platform | You need | Good for |
| --- | --- | --- | --- |
| A. Cloud build (EAS) | Android | A free Expo account | Easiest; no Android Studio |
| B. Local build | Android | Android Studio, USB cable | Fast rebuilds while fixing code |
| C. Local build | iPhone | A Mac with Xcode, free Apple ID | iPhone testing without paying |
| D. Cloud build (EAS) | iPhone | Paid Apple Developer account ($99/year) | iPhone testing without a Mac |

For the walking test, use a **preview** build (routes A and D, or a Release build in B and C).
It runs on its own. A **development** build needs your computer running `npx expo start` on the
same Wi-Fi, which is handy at a desk but not outdoors.

## 0. One-time setup (all routes)

1. Install [Node.js](https://nodejs.org) 22 or newer and [Git](https://git-scm.com).
2. Get the code and install dependencies:

   ```bash
   git clone https://github.com/beldatronai/fmic.git
   cd fmic/prototype
   npm install
   ```

3. Optional check that the logic works: `npm test` and `npm run typecheck`.

## A. Android, cloud build (recommended first)

1. Create a free account at [expo.dev](https://expo.dev/signup).
2. Log in and link the project (this adds a project id to `app.json`; commit that change):

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

3. Start the build:

   ```bash
   npx eas-cli@latest build --profile preview --platform android
   ```

   It runs on Expo's servers and takes roughly 10 to 20 minutes. Answer "yes" when asked to
   generate an Android keystore.
4. When it finishes, the terminal shows a link and a QR code. Open it on each Android phone and
   download the `.apk`.
5. Install it. Android will ask you to allow installs from your browser or file manager
   ("Install unknown apps"); allow it for that app only.
6. Open **Lighthouse Prototype** and allow Bluetooth, Nearby devices and Location when asked.
   Android requires Location permission for Bluetooth scanning.

## B. Android, local build

1. Install [Android Studio](https://developer.android.com/studio). In its SDK Manager, install
   the latest Android SDK and Platform Tools, and set `ANDROID_HOME` as its setup guide says.
2. On the phone: Settings, About phone, tap **Build number** seven times to unlock Developer
   options. Then turn on **USB debugging** in Developer options.
3. Connect the phone by USB, accept the "Allow USB debugging" prompt, and check that
   `adb devices` lists it.
4. Build and install:

   ```bash
   npx expo run:android --device --variant release   # standalone, for field tests
   npx expo run:android --device                     # development build, needs `npx expo start`
   ```

   The first build takes a while because it downloads Gradle and dependencies.
5. Repeat for the second phone, or share the APK from
   `android/app/build/outputs/apk/release/app-release.apk`.

## C. iPhone, local build on a Mac

1. Install Xcode from the Mac App Store, open it once to finish setup, and sign in with your
   Apple ID under Xcode, Settings, Accounts. A free Apple ID works.
2. Install CocoaPods if Xcode does not prompt for it: `brew install cocoapods`.
3. Change `ios.bundleIdentifier` in `app.json` to something unique to you, for example
   `com.yourname.lighthouse`. Free accounts can't use an id someone else has registered.
4. Connect the iPhone by cable, unlock it and tap **Trust**. On iOS 16 or newer, also turn on
   Settings, Privacy & Security, **Developer Mode** and restart.
5. Build and install:

   ```bash
   npx expo run:ios --device --configuration Release   # standalone, for field tests
   npx expo run:ios --device                           # development build, needs `npx expo start`
   ```

   If Xcode reports a signing error, open `ios/*.xcworkspace`, pick your team under
   Signing & Capabilities, and run the command again.
6. The first time, iOS blocks the app. Go to Settings, General, VPN & Device Management, tap
   your Apple ID and choose **Trust**.
7. Allow Bluetooth when the app asks.

With a free Apple ID the app stops opening after 7 days; rebuild to renew it.

## D. iPhone, cloud build (paid Apple account)

1. Do steps 1 and 2 of route A.
2. Register each test iPhone. Open the link this prints on the phone and install the profile:

   ```bash
   npx eas-cli@latest device:create
   ```

3. Build:

   ```bash
   npx eas-cli@latest build --profile preview --platform ios
   ```

   Sign in with your Apple Developer account when asked and let EAS manage certificates.
4. Open the finished build's link on each registered iPhone and install it.

## Troubleshooting

- **Status shows `poweredOff`**: Bluetooth is off. Turn it on and reopen the screen.
- **Status shows `unauthorized`**: a permission was denied. Allow it in the phone's settings
  for Lighthouse Prototype (Android: Nearby devices and Location; iPhone: Bluetooth).
- **Phones don't see each other**: both apps must be open with the screen on. Go back to the
  home screen and re-enter the mode to restart Bluetooth.
- **Build fails in the Swift or Kotlin Bluetooth code**: this native code had not been compiled
  before this branch was pushed. Paste the error into the project thread and it will be fixed.
- **"Unable to resolve module"** after pulling new code: run `npm install` again.
