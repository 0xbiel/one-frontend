# ONE frontend

ONE is a calm, caregiver-facing web experience for a daily home check-in. It presents observations with context and uncertainty — never a diagnosis — and lets a paired laptop, iPhone, or Android browser act as a consented camera publisher.

## Run locally

```bash
npm install
test -f .env || cp .env.example .env
npm run dev
```

The default is deterministic demo mode (`VITE_DEMO_MODE=true`), so the dashboard, map, events, assistant, privacy controls, pairing code, and publisher consent flow render without a backend. Set `VITE_DEMO_MODE=false` to use the API client.

### Authentication (backend mode)

Authentication is pairing-based: open `/login`, enter the six-digit code created
by the home admin, and the frontend calls `POST /api/v1/pairing/complete`. The
returned bearer token, home ID, and user ID are kept in `sessionStorage` for the
current browser tab and sent on subsequent `/api/v1` requests. On reload, the
frontend validates the session with `GET /api/v1/me`; an expired or revoked
session returns to `/login` without rendering dashboard data. The publisher and
dashboard routes are therefore unavailable until a valid session exists (the
`/join/:code?` pairing entry point remains public).

Click the avatar in the top bar to sign out. ONE first calls
`DELETE /api/v1/sessions/current`, then clears all browser session storage,
stops any active camera/microphone publisher, clears cached queries, and returns
to `/login`. Demo mode intentionally bypasses this gate so the deterministic
review experience remains available.

Account setup routes are `/create-account` (creates a home with
`POST /api/v1/pairing/start` and signs the creator in), `/join-household` (accepts
`POST /api/v1/family/invites/accept`), and `/onboarding` (records audio, video,
family, and medication-purpose choices, then stores a scoped local completion
state). Publisher pairing at `/join/:code?` remains a camera-only flow; an
admin/caregiver must be signed in before creating a publisher code.

For the backend, set `VITE_API_BASE_URL` to the FastAPI `/api/v1` origin. LiveKit configuration is deliberately kept behind the backend token endpoint; the frontend must receive a room URL/token from `POST /homes/{home_id}/livekit/token`. The local Compose stack runs self-hosted LiveKit on `ws://localhost:7880` with development credentials; no LiveKit Cloud subscription is used. For a phone, override the backend's `ONE_LIVEKIT_URL` with a host-reachable LAN/Tailscale endpoint.

### Open the website through Docker

From the sibling backend repository, `docker compose up --build api frontend`
starts the API and the static web container. Open <http://127.0.0.1:4175>.
The container uses `/api/v1` on the same origin and proxies it to FastAPI, so
the browser never needs a hard-coded host address. Set `VITE_DEMO_MODE=true`
only for the deterministic demo; use `false` with a seeded backend home.

For a Tailscale-only HTTPS URL, install Tailscale on the host and run
`tailscale serve --bg http://127.0.0.1:4175`. Use the HTTPS URL printed by
`tailscale serve status` as the iOS API base URL with the `/api/v1` suffix.

## Routes

- `/dashboard` caregiver overview
- `/dashboard/map` camera-derived 2D map, with native LiDAR-only RoomPlan 3D
- `/dashboard/events` meaningful-event timeline
- `/dashboard/assistant` evidence-aware assistant
- `/dashboard/family` household circle, least-privilege roles, and today’s reminder plan
- `/dashboard/privacy` consent, pause, export, and delete UX
- `/publisher` camera/microphone consent and local preview
- `/join/ONE-482` pairing entry point

## Backend contract

The typed adapter in `src/api/client.ts` targets the FastAPI routes in `../one`: session bootstrap (`GET /me`), pairing (`POST /pairing/start`, `/pairing/complete`, and authenticated same-home publisher pairing), LiveKit token issuance, cameras, RoomPlan scene/maps, objects, events, consent, and privacy export/delete. Demo mode remains the default so the UI renders without the backend; set `VITE_DEMO_MODE=false` for real API calls. `src/api/schema.d.ts` is generated with `npm run generate:api`. The generator uses the sibling backend contract when this repository is checked out beside `one`, and otherwise uses the pinned snapshot at `contracts/openapi.json`, keeping a standalone GitHub checkout buildable. Update that snapshot whenever the backend contract tag changes; CI fails if regeneration changes the committed artifact. `src/api/sse.ts` consumes the authenticated `/homes/{home_id}/events/stream` contract and invalidates dashboard queries when replayable event data arrives.

Family mode uses the live family endpoints when a non-demo session is present:
`GET /homes/{home_id}/family/members` and
`GET /homes/{home_id}/medication-reminders`. A real session must have active
`family_mode` and `medication_management` consent; otherwise the page shows an
explicit access note and no live records. Demo mode uses synthetic accounts to
make the interaction reviewable: a household member can also be a caregiver,
each reminder names its assigned caregiver and acknowledgement state, and
weekly/date-specific schedule rules are shown instead of assuming every dose is
daily. The organizer assistant CTA remains grounded in schedule organization
and never presents medical advice.

## LAN camera note

Mobile browsers generally require a secure context before allowing camera/microphone access. For a phone connecting to a laptop over the LAN, serve the app and API over trusted local HTTPS (for example, a locally trusted certificate/reverse proxy) and use `wss://` for LiveKit. `http://localhost` is suitable for laptop-only testing but is not a reliable phone deployment path.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite covers the dashboard, route rendering, pairing/session storage,
and contract/SSE mapping. The local integration checklist additionally exercises
live FastAPI pairing, consent, family invite, and logout with synthetic data;
real camera/WebRTC and physical-device checks remain environment-dependent.
