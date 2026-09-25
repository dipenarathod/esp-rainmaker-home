<!--
SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD

SPDX-License-Identifier: Apache-2.0
-->

# Reading a Crashlytics crash

Crashes land in the **esp-novahome** Firebase project — one console for both
platforms. A release build is minified and stripped, so the stack you see is not
the stack you need. This is how to get from what the console shows to a file and
line in this repo.

Everything below is done on your machine from two files. You never run the app,
and you do not need a device, an emulator, or the crashed commit checked out.

---

## 1. Decide which kind of crash it is

Look at the frames in the console. They fall into two kinds, needing two
different artifacts.

| What the frame looks like | Kind | What resolves it |
| --- | --- | --- |
| `handleSignIn@1:5225213` | **JavaScript** — your `.ts` / `.tsx` code | Metro **source map** |
| `-[RCTBridge invokeAsync:]`, `libhermes`, a bare address | **Native** — ObjC / C++ / Java | **dSYM** (iOS) / **R8 mapping** (Android) |

The giveaway for a JS crash is the `@1:` form: a function name, then a bundle
offset. Hermes preserves function names but not file or line, so the number is a
byte offset into the minified bundle and means nothing on its own.

**Native frames need no work from you.** The symbols are uploaded automatically
by CI — the Crashlytics Gradle plugin on Android, and the fastlane
`upload_crashlytics_symbols` lane on iOS — so the console shows them already
resolved. If native frames look raw, the upload failed for that build; check the
build's job log rather than trying to symbolicate locally.

The rest of this page is about **JavaScript** frames.

---

## 2. Copy the stack into a file

From the Crashlytics page, copy just the frame lines into a plain text file,
`stack.txt`:

```
handleSignIn@1:5225213
_performTransitionSideEffects@1:746473
onResponderRelease@1:745302
```

Lines only. No timestamps, no surrounding console furniture.

**iOS needs reformatting first.** The Apple export writes frames differently and
`metro-symbolicate` rejects them as-is:

```
0  ???   0x0 anonymous + 1 (main.jsbundle:1:6718007:1)
```

Take the two numbers out of the brackets and rewrite each line as
`name@LINE:COLUMN`, dropping the leading `0 ??? 0x0` and the trailing `:1`:

```
anonymous@1:6718007
```

`anonymous` is normal on iOS — unlike Hermes on Android, real function names
often do not survive. So on iOS the map is not a convenience: without it a JS
frame tells you nothing at all.

---

## 3. Get the source map for that commit

> A map from a **different commit** resolves the offsets to **wrong file names,
> with no error at all**. Match the app version in the Crashlytics report to the
> commit that produced the map.

The map does not have to come from the identical build. Metro and Hermes are
deterministic: two runs over the same commit, with the same `node_modules` and
the same `.env`, produce a byte-identical bundle and map — verified by building
twice with `--rerun-tasks` and comparing checksums. So a CI map works against a
locally built binary of the same commit, and vice versa.

The one thing that breaks it is a dependency drift: CI installs with `npm ci`
(exact lockfile) while a local `npm i` may pull newer transitive versions, which
changes the bundle. **Run `npm ci` before a release build** and the maps stay
interchangeable.

A debug build's map never matches a release crash — the bundles differ. Only
release maps are useful.

Both platforms keep it in the **GitLab** pipeline for **30 days**, in a job of
its own. The APK and IPA it was built beside expire after a day — a map is
~30 MB against a 150–280 MB binary, and GitLab allows one expiry per job.

| Platform | Job | Artifact |
| --- | --- | --- |
| Android | `android_sourcemap` | `artifacts/sourcemaps/index.android.bundle.<flavor>.<version>-<code>.map` |
| iOS | `ios_sourcemap` | `artifacts/sourcemaps/main.jsbundle.<version>-<build>.map` |

The iOS map is named after the version that produced it, so
`main.jsbundle.6.0.1-1.map` is the map for the build Crashlytics labels
**6.0.1 (1)** — match those two numbers against the header of the crash
report and you have the right file. `ios/.xcode.env` sets the name at build
time, which also stops one local build from overwriting the previous one.

GitLab → the pipeline → the build job → **Job artifacts** → Browse or Download.

If the artifact has expired, rebuild it: check out the commit, `npm ci`, and run
a release build with the same `.env`. Determinism is what makes that work.

---

## 4. Symbolicate

Run from anywhere the two files are. The repo is irrelevant — all the
information is in the map.

**Android**

```bash
npx metro-symbolicate index.android.bundle.map < stack.txt
```

**iOS**

```bash
npx metro-symbolicate main.jsbundle.6.0.1-1.map < stack.txt
```

Output:

```
/src/features/auth/screens/Login.tsx:214:handleSignIn
```

File, line, function. Done.

Running it inside the repo is faster only because `metro-symbolicate` is already
in `node_modules`, so `npx` downloads nothing:

```bash
cd /path/to/esp-rainmaker-home
npx metro-symbolicate ~/Downloads/index.android.bundle.map < ~/Downloads/stack.txt
```

### Read the code as it was built

Symbolication gives a file and a line, but your checkout has usually moved on —
line 88 today is rarely line 88 in a month-old release, so reading the current
file will mislead you. The map carries the original source (`sourcesContent`),
so read it from there rather than checking out the old commit:

```bash
python3 - <<'PYEOF'
import json
MAP  = 'main.jsbundle.map'                       # or index.android.bundle.map
FILE = '/src/features/group/screens/Home.tsx'    # exactly as symbolication printed it
LINE = 88

m = json.load(open(MAP))
src = m['sourcesContent'][m['sources'].index(FILE)].split('\n')
for n in range(max(0, LINE - 8), min(len(src), LINE + 7)):
    print(('>>' if n + 1 == LINE else '  ') + f' {n+1:4d} | {src[n]}')
PYEOF
```

This is authoritative — it is the exact text compiled into the build that
crashed, not whatever that file looks like now.

---

## Crashlytics groups every JS crash into one issue

Crashlytics groups by the **native** entry point, not by the JS error. Every
JavaScript crash enters through the same one:

```
ExceptionsManagerModule.reportException
com.facebook.react.common.JavascriptException
```

So unrelated JS bugs all collapse into a single issue, and its title is whichever
error happened to land there first. Two consequences:

- **The issue title tells you nothing about the cause.** Open an individual event
  and read its `Fatal Exception:` line for the real message.
- **A new production bug can hide inside an issue named after something else.**
  Check the event count and versions rather than trusting the title.

## Troubleshooting

**Frames come back unchanged, or point at implausible files.** The map is from a
different commit than the crash — or from a build whose `node_modules` had
drifted from the lockfile. Check the app version on the Crashlytics report, and
build releases with `npm ci`.

**"source map not found" in the build log.** The build produced no map, so
crashes from it can never be resolved. Both platforms warn rather than fail, so
this is easy to miss — the Android job prints it after fastlane, and `ios_ipa`
after its build step.

**The artifact has expired.** Both platforms keep 30 days. Past that, rebuild
the map from the commit — see section 3.

**Nothing arrives in Crashlytics at all from a China-region device.** That is by
design, not a bug — see below.

---

## Notes

**China region reports nothing, deliberately.** Android excludes Firebase from
the CN flavour at build time; iOS ships one binary and never calls
`FIRApp configure` when the device Region is China
(`ESPConfigureFirebaseUnlessCnRegion` in `ios/APP/AppDelegate.mm`). Crashes from
CN devices are not collected on either platform.

**Handle source maps as source.** A map embeds `sourcesContent` — the complete
original source of the build. Keep maps in CI artifacts. Never attach one to a
release page or share it outside the team.

**iOS push is not Firebase.** Notifications go through APNs directly via
`ESPNotificationModule`; Firebase on iOS is Crashlytics only. Nothing in this
document applies to push.
