#!/data/data/com.termux/files/usr/bin/sh
# Starts (or restarts) the message history download in the background on the
# phone, retrying until it finishes. Safe to rerun: it resumes from its cursor.
#   scp -i ~/.ssh/rushmore_pixel -P 8022 deploy/pixel/start-backfill-messages.sh <phone>:~/rushmore/
#   ssh -i ~/.ssh/rushmore_pixel -p 8022 <phone> sh rushmore/start-backfill-messages.sh
cd ~/rushmore || exit 1

# Stop an earlier run first. [u] keeps pkill from matching this script.
pkill -f '[u]ntil .*backfill-messages' 2>/dev/null
pkill -f '[n]ode dist/backfill-messages' 2>/dev/null

nohup sh -c "until $PREFIX/bin/node dist/backfill-messages.js; do sleep 30; done" \
    > logs/backfill-messages.log 2>&1 < /dev/null &
echo "started, log: ~/rushmore/logs/backfill-messages.log"
