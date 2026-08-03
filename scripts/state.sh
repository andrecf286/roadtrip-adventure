#!/usr/bin/env bash
# Print a one-screen picture of what's actually in the database.
# Useful at the start of any session: what is seeded plan vs. what the girls
# have actually produced vs. what the track has collected.
set -euo pipefail
cd "$(dirname "$0")/../worker"

cat > /tmp/_fmt.py <<'PY'
import json, sys
txt = sys.stdin.read()
d, _ = json.JSONDecoder().raw_decode(txt[txt.index("["):])
for r in d[0]["results"]:
    flag = "   <-- EMPTY" if r["n"] == 0 else ""
    print("  {:<18}{:>8}{}".format(r["t"], r["n"], flag))
PY

q () { npx --yes wrangler@latest d1 execute roadtrip --remote --json --command "$1" 2>/dev/null | python3 /tmp/_fmt.py; }

echo "THE PLAN — seeded from Lily's vault"
q "SELECT 'intention' t,COUNT(*) n FROM intention UNION ALL SELECT 'activity',COUNT(*) FROM activity UNION ALL SELECT 'reservation',COUNT(*) FROM reservation;"

echo
echo "WHAT HAPPENED — the girls fill these"
q "SELECT 'stop' t,COUNT(*) n FROM stop UNION ALL SELECT 'photo',COUNT(*) FROM photo UNION ALL SELECT 'journal_entry',COUNT(*) FROM journal_entry;"

echo
echo "LINKS AND TRACK"
q "SELECT 'day_intention' t,COUNT(*) n FROM day_intention UNION ALL SELECT 'activity done',COUNT(*) FROM activity WHERE done=1 UNION ALL SELECT 'track_points',COUNT(*) FROM track_points;"

echo
echo "LIVE INGEST"
curl -s https://api.roadtripadventure.app/stats \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  {:<18}{:>8}'.format('points', d['track_points'])); print('  {:<18}{:>8} min ago'.format('last event', d['minutes_since_last_event']))"
