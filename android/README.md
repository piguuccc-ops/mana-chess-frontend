# Mana Chess for Android

The Android app is the same game as the web page, packed into an APK: it opens full screen, works
without a network (the bots, two players on one phone) and plays online on your server like the
browser version. It is a small native shell (`MainActivity.java`) around a WebView that serves the
bundled game from the APK itself.

What the app adds to the page:

- **full screen** on any phone or tablet, upright or on its side – the notch is respected and the
  keyboard pushes the page up instead of covering the field you type into;
- **vibration** on moves, captures, checks and the end of a game (Settings → Rezgés);
- the screen **stays on** while a game is open;
- the **back button** closes what is open (a card, a dialog), asks before leaving a game, and on
  the main menu sends the app to the background;
- the sounds stop when the app is in the background.

## Getting the APK

Every version tag (`git tag v1.2.0 && git push --tags`) makes the **Release files** workflow build
the APK and attach it to the GitHub release as `mana-chess-v1.2.0.apk`. On the phone: download it,
open it, allow installing from this source once, done. Updating is the same: install the new APK
over the old one – the decks and settings stay.

> Phones only accept an update signed with **the same key** as the installed app. Set up the
> signing key once (below) and never change it.

## Signing key (once)

Make a key (any machine with a JDK; keep the file and the password safe – not in the repository):

```bash
keytool -genkeypair -keystore mana-chess-release.keystore -storetype PKCS12 \
  -alias manachess -keyalg RSA -keysize 4096 -validity 10950 \
  -dname "CN=Mana Chess, O=Mana Chess, C=HU"
```

Then in the GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the keystore file as base64: `base64 -w0 mana-chess-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore's password |
| `ANDROID_KEY_ALIAS` | `manachess` |
| `ANDROID_KEY_PASSWORD` | the key's password (with PKCS12 the same as the keystore's) |

Without these secrets the workflow still builds an APK, signed with a throwaway key – fine for a
try, but such an APK cannot be updated by the next one.

**Your server as the default:** add a repository *variable* (same page, Variables tab)
`MANA_BACKEND` with your backend's address (e.g. `https://chess.example.com`). The app then offers
that server on the Online screen by itself; players can still type in any other.

## Building it yourself

You need a JDK (17+), the Android SDK command-line tools (build-tools and a platform ≥ 33 – Android
Studio installs them) and Node.js:

```bash
npm install
npm run build                 # the game page: dist/mana-chess.html
ANDROID_HOME=~/Android/Sdk \
KEYSTORE=mana-chess-release.keystore KEYSTORE_PASSWORD=… KEY_ALIAS=manachess \
MANA_BACKEND=https://chess.example.com VERSION_CODE=3 VERSION_NAME=1.2.0 \
npm run android               # → android/build/mana-chess.apk
```

No Gradle is involved: `build.sh` runs `aapt2`, `javac`, `d8`, `zipalign` and `apksigner` itself,
so the build is the same on a laptop and in GitHub Actions. Install on a phone connected with USB
debugging: `adb install -r android/build/mana-chess.apk`.

`VERSION_CODE` must grow with every release: the release workflow takes it from the tag (`v1.2.3` →
`10203`), so tag versions in order. (The on-demand *Android app* workflow uses its run number – those
test builds are not meant to be installed over a release.)

## The game and the server must match

Online play needs the app and the backend to run the same rules (the same release). When the
server is updated, update the app too: a version clash shows an **„Az alkalmazás frissítése”**
button that opens the latest release.

## Files

```
android/
  build.sh                       the build (see above)
  scripts/make-icons.ts          draws the launcher icons from the game's pixel art (npm run android:icons)
  app/src/main/
    AndroidManifest.xml          one activity; internet (online play), vibration
    java/hu/manachess/game/MainActivity.java
    res/                         icons (adaptive + themed), start screen, theme,
                                 network_security_config.xml (plain http allowed for home-network servers)
```

Security notes: the WebView only loads the bundled page (other links open in the browser), file
access is off, and the JavaScript bridge offers nothing but vibration, keeping the screen on,
opening a link and the app's version.
