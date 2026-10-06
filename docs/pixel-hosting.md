# Pixel hosting

Since 2026-10-05 the bot is self-hosted on a Pixel 6 Pro (Android 17) running Termux, instead of a cloud instance.

## Access

The phone is on the tailnet, so no USB cable is needed.

| | |
|---|---|
| Tailscale IP | `<phone-tailscale-ip>` |
| SSH port | `8022` (Termux sshd) |
| SSH key | `~/.ssh/rushmore_pixel` (key auth only) |

```sh
# Over Tailscale (Mac must be connected to the same tailnet)
ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone-tailscale-ip>

# Fallback over USB
~/Library/Android/sdk/platform-tools/adb forward tcp:8022 tcp:8022
ssh -i ~/.ssh/rushmore_pixel -p 8022 localhost
```

`adb` is not on the Mac's `PATH`; use the full SDK path above.

Tailscale on the phone is installed from the official APK (`pkgs.tailscale.com/stable`, v1.102.4), not the Play Store — see [troubleshooting](troubleshooting.md#play-store-cant-download-anything-on-home-wi-fi). It may not auto-update.

## Services (runit via termux-services)

Services live in `$PREFIX/var/service/` and are supervised by `runsvdir`. Always set `SVDIR` first:

```sh
export SVDIR=$PREFIX/var/service
sv status rushmore sshd
sv restart rushmore
```

| Service | What it runs | Logs |
|---|---|---|
| `rushmore` | `$PREFIX/bin/node dist/index.js` in `~/rushmore` | `~/rushmore/logs/current` |
| `sshd` | `sshd -D -e` (restarts automatically if it dies) | `$PREFIX/var/log/sv/sshd/current` |

`cupsd` and `ssh-agent` services also exist from the termux-services package but are not used.

### Local change to the sshd log script

`$PREFIX/var/service/sshd/log/run` expects `$LOGDIR`, which `runsvdir` doesn't have in its environment, so the logger crashed and sshd never started. Line added before `mkdir`:

```sh
LOGDIR=${LOGDIR:-$PREFIX/var/log}
```

A `pkg upgrade` of `termux-services` may overwrite this; re-apply it if sshd stops being supervised.

## Deploying

From the repo on the Mac:

```sh
npm run build
scp -i ~/.ssh/rushmore_pixel -P 8022 dist/index.js <phone-tailscale-ip>:~/rushmore/dist/index.js
ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone-tailscale-ip> 'SVDIR=$PREFIX/var/service sv restart rushmore'
```

App layout on the phone: `~/rushmore/{dist/index.js, data/, .env, logs/}`. Copy `.env` by hand; it's not in git.

### Seeding the game library

`/juegos` reads from the same SQLite DB. To load the catalog, aliases and loans from `data/games-seed.json` (gitignored, it has Discord IDs; format in `src/scripts/seed-games.ts`):

```sh
npm run build:seed
scp -i ~/.ssh/rushmore_pixel -P 8022 dist/seed-games.js <phone-tailscale-ip>:~/rushmore/dist/seed-games.js
scp -i ~/.ssh/rushmore_pixel -P 8022 data/games-seed.json <phone-tailscale-ip>:~/rushmore/data/games-seed.json
ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone-tailscale-ip> 'cd ~/rushmore && $PREFIX/bin/node dist/seed-games.js'
```

It skips anything already there, so rerunning it is safe.

## Keeping it alive (battery settings)

Applied 2026-10-05 over adb so Android doesn't kill the bot or drop the VPN:

```sh
for p in com.tailscale.ipn com.termux; do
  adb shell dumpsys deviceidle whitelist +$p        # exempt from Doze / battery optimization
  adb shell cmd appops set $p RUN_ANY_IN_BACKGROUND allow
  adb shell cmd appops set $p RUN_IN_BACKGROUND allow
  adb shell am set-standby-bucket $p active
done
```

The screen can stay off. The developer option "Stay awake while charging" is disabled (`adb shell settings put global stay_on_while_plugged_in 0`) so the screen times out normally on the charger. Tested 2026-10-05: with the screen off and the phone dozing, the bot and SSH over Tailscale kept working.

Termux also holds a wake lock (`termux-wake-lock`, visible in its notification). `com.termux.boot` has the same battery exemptions.

## After a reboot

- **Termux:Boot** (v0.8.1, F-Droid APK, signed with the same F-Droid key as Termux 0.118.3) runs `~/.termux/boot/start-services`:
  ```sh
  #!/data/data/com.termux/files/usr/bin/sh
  termux-wake-lock
  . $PREFIX/etc/profile   # termux-services profile.d script starts runsvdir → rushmore + sshd
  ```
- **Tailscale** is set as the always-on VPN (lockdown off, so traffic still flows if the VPN is down):
  ```sh
  adb shell settings put secure always_on_vpn_app com.tailscale.ipn
  adb shell settings put secure always_on_vpn_lockdown 0
  ```
- **Unlock once after every reboot.** The phone has a PIN, so Android doesn't send the boot-completed event until the first unlock. Until then nothing starts: no bot, no Termux, and possibly no Tailscale.
- Termux plugins must match Termux's signing key. Termux here is the F-Droid build, so get plugins from F-Droid, not GitHub or the Play Store.

## Gotchas

- **Old OpenClaw install:** `~/.bashrc` puts a glibc node v22 first on `PATH` in interactive shells. The `rushmore` service uses the full path to Termux's node, so it isn't affected.
- **Careful with `pkill -f`:** avoid patterns that match the SSH session's own command line. Killing the standalone sshd listener also locks you out until it's restarted (type `sshd` in Termux on the phone).
