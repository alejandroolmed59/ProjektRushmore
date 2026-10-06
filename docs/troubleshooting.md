# Troubleshooting

## Play Store can't download anything on home Wi-Fi

**Symptom:** the Play Store shows "Try again", and `adb logcat | grep Finsky` shows `net::ERR_LOCAL_NETWORK_PERMISSION_MISSING`.

**Cause:** the home router advertises a broken IPv6 prefix, `::/64` (the phone ends up with addresses like `::478:28ff:fee7:103c/64`). Android's IPv4-mapped addresses (`::ffff:a.b.c.d`) fall inside `::/64`, so Android 17's local network protection treats every connection as local. Apps without `ACCESS_LOCAL_NETWORK` are blocked, and that includes the Play Store and the Download Manager. Termux has the permission, so the bot is unaffected.

Check it with:

```sh
adb shell ip -6 addr show wlan0   # look for an address starting with "::" instead of a real prefix like 2800:...
```

**What didn't work:** `pm grant com.android.vending android.permission.ACCESS_LOCAL_NETWORK` returns success, but the Play Store's UID-level app-op stays at `ignore`.

**Workaround:** install apps from their official APK over USB:

```sh
adb install some-app.apk
```

**Real fix (not done yet):** in the router admin page (usually `192.168.0.1`), turn IPv6 off or set it up correctly so it advertises a real prefix.
