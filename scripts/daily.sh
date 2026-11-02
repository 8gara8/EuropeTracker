#!/bin/zsh
# Entry point the scheduled task runs (SPEC §7.2, §8.3): a fixed environment, no sleep while it works.
export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
export TZ=Asia/Taipei
cd /Users/kobol/Documents/EuropeTracker || exit 1
mkdir -p logs
exec /usr/bin/caffeinate -i /opt/homebrew/bin/npx --no-install tsx scripts/daily.ts "$@"
