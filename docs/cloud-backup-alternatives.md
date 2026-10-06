# Cloud backup: alternatives to rclone's shared Google client

As of 2026-10-06. Current setup: [pixel-hosting.md, Cloud backups](pixel-hosting.md#cloud-backups).

**Recommendation:** keep the current Google Drive setup for now, and when rclone starts its 90-day notice, move the encrypted remote to Backblaze B2. That move takes about 15 minutes, needs no Google Cloud project, and keeps the same crypt passwords.

## The problem

The `gdrive` remote uses rclone's built-in Google OAuth client. Google will start charging rclone for that client's API use, so rclone is retiring it "later in 2026, following 90 days of notice". On 2026-09-19 the rclone maintainer said Google "have gone silent" and may be revising the plan; the 90-day notice hasn't started ([forum](https://forum.rclone.org/t/google-drive-and-google-photos-users-action-required/54005/)). So there are at least 90 days of warning, and rclone prints the warning on every run in `~/rushmore/logs/backup-upload.log`.

Any replacement has to keep what we have now: encrypted before it leaves the phone, copy-only (a wiped phone never deletes cloud copies), and free.

## Options

| Option | Cost | Setup | What can still break | Verdict |
|---|---|---|---|---|
| **Backblaze B2** | Free up to 10 GB, then $6.95/TB/month ([pricing](https://www.backblaze.com/cloud-storage/pricing)) | Account + bucket + application key; no OAuth | Almost nothing: application keys don't expire | **Recommended** when the notice starts |
| **Own Google OAuth client** (stay on Drive) | Free | ~15 min in Google Cloud console: project, enable Drive API, consent screen, Desktop client ([rclone guide](https://rclone.org/drive/#making-your-own-client-id)) | Must publish the app to Production; in Testing mode tokens expire every ~7 days. Unverified apps show a warning at sign-in. Tokens also die after 6 months unused (not an issue at 4 uploads/day) | Good if the files must live in Drive |
| **Cloudflare R2** | Free up to 10 GB-month, no egress fees ([pricing](https://developers.cloudflare.com/r2/pricing/)) | Account + bucket + S3 API token | Probably needs a payment method on file (not confirmed) | Fine, but B2 is simpler |
| **Google service account** | Free | Service account + JSON key | Service accounts have no storage quota in a personal My Drive, so uploads fail with `storageQuotaExceeded` unless you have a Workspace shared drive ([Google](https://discuss.google.dev/t/storagequotaexceeded-the-users-drive-storage-quota-has-been-exceeded-for-service-account/104375)) | Not viable for a personal account |
| **Relay to the Mac over Tailscale**, into a folder the Google Drive desktop app syncs | Free | rsync/launchd job on the Mac pulling from the phone | Only runs while the Mac is on; the backup now depends on two machines | Not worth it |
| **Bot posts the backup to a private Discord channel** | Free | ~30 lines in the bot: encrypt, attach the file once a day | Attachment size limit (~10 MB, approximate) as `emoji_uses` grows; backups live on the same service the bot depends on | Not worth it |

## Moving to B2 (when the notice starts)

The crypt layer stays and only the storage underneath it changes, so the passwords already in your password manager keep working.

1. Create a Backblaze account, a **private** bucket (e.g. `rushmore-backups-<random>`), and an application key limited to that bucket.
2. On the phone, add the storage and point the crypt remote at it:
   ```sh
   rclone config create b2 b2 account=<keyID> key=<applicationKey> --non-interactive > /dev/null
   rclone config update rushmore-backup remote=b2:<bucket>
   ```
3. Re-upload what's still on the phone and check it:
   ```sh
   rclone copy ~/rushmore/data/backups rushmore-backup: --include 'rushmore-*.db'
   rclone cryptcheck ~/rushmore/data/backups rushmore-backup: --include 'rushmore-*.db'
   ```
   To keep older history, run `rclone copy gdrive:rushmore-backups b2:<bucket>` first. It copies the encrypted files as-is, since both sides use the same crypt keys.
4. Nothing changes in `deploy/pixel/rushmore-backup/run`: it only knows the `rushmore-backup:` remote name. Update the Cloud backups section in `pixel-hosting.md`.

## Sources

- rclone forum: [Google Drive and Google Photos users, ACTION REQUIRED](https://forum.rclone.org/t/google-drive-and-google-photos-users-action-required/54005/) and [ClientID automation](https://forum.rclone.org/t/clientid-automation-winter-is-coming-deadline-closing-in/54145) (no API exists to create OAuth clients automatically)
- rclone docs: [Google Drive, making your own client_id](https://rclone.org/drive/#making-your-own-client-id)
- [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing), [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Google developer forum: [service accounts and storageQuotaExceeded](https://discuss.google.dev/t/storagequotaexceeded-the-users-drive-storage-quota-has-been-exceeded-for-service-account/104375)
