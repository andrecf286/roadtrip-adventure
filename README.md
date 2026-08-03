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
worker/          Cloudflare Worker — Bouncie webhook receiver
  src/index.js   Ingest endpoint, auth, event parsing
  migrations/    D1 schema, applied in order
scripts/         backfill and seed utilities
  wrangler.jsonc Deploy config
```

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
