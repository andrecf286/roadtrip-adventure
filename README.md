# Roadtrip Adventure

A private journal and aggregator for Lily and Ada's 2026 cross-country road trip
(departed 2026-08-02, roughly six weeks). Lives at `roadtripadventure.app`.

## What this is

An **aggregator**, not a capture tool. The girls already capture almost everything
without any help: photos come from the iOS camera, the GPS track comes from a Bouncie
device wired into the vehicle, and the day-to-day narration already happens in a group
iMessage thread. Building a competing capture app would lose — nobody opens a web app
to photograph the Grand Canyon when the camera is on the lock screen.

So this pulls those existing sources together and adds only the two things nothing
else does:

1. **A "record a stop" button** — one tap, six types (gas, food, campsite, lodging,
   event, observation), stamped with time and position. Has to be under five seconds
   at a gas pump, or it won't get used.
2. **A readable, revisable itinerary** — easier to read than the Obsidian original,
   and editable from the road.

Everything else — the map, the badges, the photo gallery, the journal — is assembled
from data that was going to exist anyway.

Audience is the two of them plus their parents. That's it. No public tier.

## The itinerary is aspirational

This is a design constraint, not a caveat. The itinerary is a list of *intentions*,
not a schedule to be held to. When they spend an extra day somewhere or skip a
campground, nothing has gone wrong and nothing should be flagged as a variance. An
intention that never gets taken up just stays on the list, unvisited.

The distinction that does matter: **intentions are soft, reservations are hard.**
A campsite with a confirmation number, a price, and a cancellation deadline is a
different kind of object from "we'd like to see Point Arena," and the app treats
them differently.

## Why the ingest Worker exists before anything else

Bouncie exposes trip data two ways, and they are not equivalent:

- **REST** (`GET /v1/trips`) returns each trip's route as an encoded polyline —
  an ordered list of coordinates with **no per-point timestamps**, just a trip
  start and end time. Retained indefinitely, fetchable forever.
- **The `tripData` webhook** delivers timestamped breadcrumbs: position, speed,
  heading, and fuel level at each point. **Push-only and forward-only — there is
  no replay endpoint.**

So route *shape* can be backfilled at any time, but the time axis only exists if
something was listening when it happened. Every day without a live receiver is a day
permanently reduced to interpolated position. That asymmetry is why `worker/` was
built and deployed before the data model was settled.

## Layout

```
worker/
  src/index.js    Ingest endpoint — auth, event parsing
  migrations/     D1 schema, applied in numeric order
  wrangler.jsonc  Deploy config
scripts/
  backfill_trips.py    Historical trips from the Bouncie REST API
  seed_itinerary.py    People, days, and the itinerary overlay from the vault
```

## Data model — the day is the spine

The trip is a sequence of days. Track segments, stops, photos and journal entries
all attach to a day; the itinerary is an *overlay* on that timeline rather than the
structure beneath it.

The instinct is to organise by destination. That fails here because the itinerary is
aspirational: destinations get skipped, split across non-consecutive days, merged,
or invented on the spot with no plan entry behind them — the diner, the breakdown,
the person met at a campground. A destination-shaped spine can't hold those. A day
can't be revised.

It also makes "didn't happen" free. An intention with no days attached is simply
unvisited — no variance state, no error, no flag.

Badges are derived in views, never stored. States and miles come from the track;
attractions come from checking off Lily's own activity lists.

**Timezones:** they cross three. Every instant is stored UTC in a `*_at` column with
the local offset alongside, and day assignment always uses the *local* date — an 11pm
photo belongs to that evening, not to the UTC day already underway in Greenwich.

## Ingest Worker

Deployed at **https://api.roadtripadventure.app**

| Endpoint | Purpose |
|---|---|
| `POST /bouncie` | Webhook receiver. Requires the shared `authKey` in either `Authorization` or `X-Bouncie-Authorization`. |
| `GET /health` | Liveness. |
| `GET /stats` | Completeness monitor — points stored, last event received, minutes since, per-day breakdown. |

### Two deliberate choices about not losing data

**Raw-first.** Every request body is archived verbatim into `webhook_events` before
anything parses it. A parser bug costs a re-parse, never the data.

**200 on parse failure.** If the raw insert succeeded, the endpoint returns 200 even
when parsing throws. Bouncie auto-deactivates webhooks that keep erroring, and a
deactivated webhook is silent, permanent loss — far worse than a row that needs
reprocessing. A 500 goes back only when durable storage itself fails, which is the
one case where a retry actually helps.

`GET /stats` exists because the server, not the phone or the device, should be the
source of truth on whether data is still arriving. A stall needs to be noticeable
within a day rather than discovered in September.

## Deploying

```sh
export CLOUDFLARE_API_TOKEN=...      # see the arc credential
export CLOUDFLARE_ACCOUNT_ID=...
cd worker
npx wrangler d1 execute roadtrip --remote --file=./migrations/00N_name.sql   # in order
npx wrangler deploy
```

**Do not add a `routes` block to `wrangler.jsonc`.** The available Cloudflare token
lacks Workers Routes edit on this zone and the deploy will fail with auth error 10000.
The custom domain is already bound via the account-scoped endpoint:

```sh
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"environment":"production","hostname":"api.roadtripadventure.app",
       "service":"roadtrip-ingest","zone_id":"<zone>"}'
```

## Secrets

None are committed. The Bouncie `authKey` is a Worker secret (`AUTH_KEY`), set with
`wrangler secret put AUTH_KEY`. Credentials live in the Novalyst arc at
`Memory/Credentials/roadtrip-adventure-app.md`.

## Bouncie API notes

- Docs: https://docs.bouncie.dev/ · spec: https://docs.bouncie.dev/openapi.json
- The `Authorization` header takes the **bare token — no `Bearer` prefix.** This is
  the documented top cause of 401s.
- `GET /v1/trips` accepts a date window of **at most one week**. Backfilling six weeks
  means six sequential calls; a single wide range fails.
- Trip data is retained indefinitely, back to 2020-05-21.

## The app

Deployed at **https://roadtripadventure.app** as a second Worker, `roadtrip-app`,
sharing D1 with the ingest Worker and nothing else. The separation is the point:
ingest holds the one irrecoverable thing on this project and should almost never
be redeployed, while the app deploys constantly.

Auth is a signed token carrying a person id and a 120-day expiry, delivered as a
one-time link and stored in an httpOnly cookie. No password, no email round-trip
at use time — Lily and Ada are opening this at a gas pump, not at a desk.
`GET /mint?k=$MINT_SECRET` prints all six links for out-of-band distribution;
standing up domain-verified transactional email to deliver six links once would
be more infrastructure than the problem has.

Stops queue in localStorage when there is no signal and flush on reconnect. The
client mints the id, so a retry can never double-record.

Polylines are thinned server-side before they reach a phone — Bouncie records a
point every few seconds and the raw map payload was 179 KB on day two. Ninety
points per segment is indistinguishable at this zoom and keeps the whole trip
under ~15 KB.

Deploy: `cd app && npx wrangler deploy`. Secrets are `SESSION_SECRET` and
`MINT_SECRET`.

## The nightly sweep

The webhook is the real-time path. The sweep is the guarantee.

On 2026-08-03 the trip-event handler read the wrong envelope key, bound a row
of NULLs, and returned 200 to Bouncie eight times without throwing. Four hours
of driving never reached the database and nobody found out until Andy looked
at a mileage figure and knew it was wrong. Silent success is the failure mode
this project keeps hitting.

So `roadtrip-ingest` now runs a scheduled sweep at 09:10 UTC that re-pulls the
last four days from Bouncie's REST API and fills any gaps. Trips are retained
indefinitely upstream, so the worst case for a future parser bug becomes "the
numbers are right by morning" rather than "part of the trip is gone".

`COALESCE` favours what is already stored, so the sweep repairs holes and never
overwrites the live path. Every run — including failures — records itself in
`sweep_runs`, and `GET /stats` reports the last one, because a sweep that
silently stops running is the same class of bug it exists to catch.

Manual trigger: `POST /sweep?days=N` with the ingest auth key.
