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
| `rushmore-backup` | uploads `data/backups/` to Google Drive every 6h ([Cloud backups](#cloud-backups)) | `~/rushmore/logs/backup-upload.log` |

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

Everything, betting included, lives in `data/rushmore.db`; the bot needs no cloud database. Betting moved off DynamoDB without importing the old data, so balances start fresh: everyone runs `!cajero` again for 1000 CCC. The phone's `.env` no longer needs `AWS_REGION` or the `*_TABLE_NAME` vars.

### Seeding the game library

`/juegos` reads from the same SQLite DB. To load the catalog, aliases and loans from `data/games-seed.json` (gitignored, it has Discord IDs; format in `src/scripts/seed-games.ts`):

```sh
npm run build:seed
scp -i ~/.ssh/rushmore_pixel -P 8022 dist/seed-games.js <phone-tailscale-ip>:~/rushmore/dist/seed-games.js
scp -i ~/.ssh/rushmore_pixel -P 8022 data/games-seed.json <phone-tailscale-ip>:~/rushmore/data/games-seed.json
ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone-tailscale-ip> 'cd ~/rushmore && $PREFIX/bin/node dist/seed-games.js'
```

It skips anything already there, so rerunning it is safe.

## Cloud backups

The bot writes one consistent snapshot a day to `data/backups/rushmore-YYYY-MM-DD.db` and keeps the last 7 (`backupDb` in `src/database/sqlite.ts`). The `rushmore-backup` service (`deploy/pixel/rushmore-backup/run`) copies them to Google Drive with rclone every 6 hours and deletes Drive copies older than 60 days. It only uploads the snapshots, never the live `rushmore.db`, and uses `rclone copy`, so losing files on the phone never deletes anything on Drive.

The DB has real server data (Discord IDs, debts, balances), so the Drive copies are encrypted with an rclone `crypt` remote. Drive only sees scrambled names and contents.

### Setup (once)

Being signed in to Google on the phone doesn't help here: rclone needs its own OAuth token, and Termux has no browser to get one, so the Mac does the sign-in. Install rclone on both:

```sh
brew install rclone          # Mac
pkg install rclone           # phone
```

Then on the phone, `rclone config`:

1. New remote `gdrive`, storage `drive`, leave client id/secret empty, scope `drive.file` (rclone can only see files it created, not the rest of the Drive). Answer **n** to "Use web browser to automatically authenticate". rclone prints a command like `rclone authorize "drive" "eyJ..."`: run that exact command on the Mac, sign in in the browser, and paste the token it prints back into the phone.
2. New remote `rushmore-backup`, storage `crypt`, remote `gdrive:rushmore-backups`, filename encryption `standard`, and let rclone generate both passwords.
3. **Save the two crypt passwords in a password manager.** They live only in `~/.config/rclone/rclone.conf` on the phone. If the phone dies without them, the Drive backups can't be decrypted.

Check it on the phone:

```sh
rclone copy ~/rushmore/data/backups rushmore-backup: --include 'rushmore-*.db' -v
rclone ls rushmore-backup:
```

Install the service. From the Mac:

```sh
ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone-tailscale-ip> 'mkdir -p $PREFIX/var/service/rushmore-backup'
scp -i ~/.ssh/rushmore_pixel -P 8022 deploy/pixel/rushmore-backup/run \
    <phone-tailscale-ip>:/data/data/com.termux/files/usr/var/service/rushmore-backup/run
ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone-tailscale-ip> \
    'chmod +x $PREFIX/var/service/rushmore-backup/run && SVDIR=$PREFIX/var/service sv up rushmore-backup && sleep 5 && tail ~/rushmore/logs/backup-upload.log < /dev/null'
```

runsvdir picks up the new directory within a few seconds, and Termux:Boot starts it after a reboot like the other services.

### Current setup (2026-10-06)

Set up as above, with two differences: the passwords were generated on the phone and written to `~/rclone-crypt-passwords.txt` (mode 600), and the remotes were created with `rclone config create ... --non-interactive` instead of the interactive prompts. **Move those passwords to a password manager, then delete the file.**

**Known risk: the Google client.** The `gdrive` remote uses rclone's shared Google OAuth client, which rclone says "is being retired and will stop working during 2026". When that happens, uploads fail and `backup-upload.log` shows `upload failed`. To fix it, create your own OAuth client in Google Cloud ([rclone guide](https://rclone.org/drive/#making-your-own-client-id), Desktop app type, Drive API enabled), then on the phone run `rclone config update gdrive client_id=... client_secret=...` followed by `rclone config reconnect gdrive:`, which asks for the same sign-in on the Mac as the first setup. The crypt remote and its passwords don't change. Other options, including moving off Drive: [cloud-backup-alternatives.md](cloud-backup-alternatives.md).

### Restoring

```sh
rclone ls rushmore-backup:                                   # pick a date
rclone copy rushmore-backup:rushmore-2026-10-06.db ~/restore/
SVDIR=$PREFIX/var/service sv stop rushmore
cd ~/rushmore/data && mv rushmore.db rushmore.db.broken && rm -f rushmore.db-wal rushmore.db-shm
cp ~/restore/rushmore-2026-10-06.db rushmore.db
SVDIR=$PREFIX/var/service sv start rushmore
```

Run these on the phone. On a new phone, first redo the setup above, entering the **saved** crypt passwords instead of generating new ones.

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
