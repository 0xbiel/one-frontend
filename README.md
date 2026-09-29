<p align="center">
  <img src="branding/one-logo.png" alt="ONE logo" width="128" />
</p>

# ONE frontend

**Windows / VS Code:** start with [GUIA-PARA-VSCODE.md](GUIA-PARA-VSCODE.md). The public website implements the supplied product, detail, technology, and support concepts as navigable React pages, with five selectable variants in each section.

ONE is a calm, caregiver-facing web experience for a daily home check-in. It presents observations with context and uncertainty — never a diagnosis — and lets a paired laptop, iPhone, or Android browser act as a consented camera publisher.

## Run locally

```bash
npm install
test -f .env || cp .env.example .env
npm run dev
```

Use `npm run dev:demo` for the deterministic demo without a backend. `npm run dev` uses the live API by default and requires a backend session.

### Authentication (backend mode)

The public site opens at `/`. `/login` uses email and password, backed by the FastAPI password endpoints. `/create-account` verifies an email code and sets the initial password. Password reset uses a fresh email code. Development mode exposes the code for local setup; production requires an email delivery provider. Passwords are PBKDF2-HMAC-SHA256 hashes and failed logins have a temporary lockout. Camera publishers keep their separate pairing flow.

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

- `/` public homepage
- `/how-it-works` interactive explanation of scanning, cameras, Hub, check-ins and interpretation
- `/login` email/password login and recovery
- `/create-account` account registration
- `/dashboard` caregiver overview
- `/products?v=1..5` five product page concepts
- `/products/hub?v=1..5` and `/products/camera?v=1..5` product detail concepts
- `/products/family` and `/products/exterior` dedicated product information pages
- `/technology?v=1..5` five technology concepts
- `/support?v=1..5` five support concepts with searchable guides
- `/dashboard/questions` questions and response-time signals received from check-ins
- `/dashboard/map` camera-derived 2D map, with native LiDAR-only RoomPlan 3D
- `/dashboard/events` meaningful-event timeline
- `/dashboard/assistant` evidence-aware assistant
- `/dashboard/family` household circle, least-privilege roles, and today’s reminder plan
- `/dashboard/privacy` consent, pause, export, and delete UX
- `/publisher` camera/microphone consent and local preview
- `/join/ONE-482` pairing entry point

## Backend contract

The typed adapter in `src/api/client.ts` targets the FastAPI routes in `../one`: session bootstrap (`GET /me`), pairing (`POST /pairing/start`, `/pairing/complete`, and authenticated same-home publisher pairing), LiveKit token issuance, cameras, RoomPlan scene/maps and camera registration, local vision, objects, events, consent, and privacy export/delete. Live API calls are the default; synthetic demo data is used only when `VITE_DEMO_MODE=true` is set explicitly. `src/api/schema.d.ts` is generated with `npm run generate:api`. The generator uses the sibling backend contract when this repository is checked out beside `one`, and otherwise uses the pinned snapshot at `contracts/openapi.json`, keeping a standalone GitHub checkout buildable. Update that snapshot whenever the backend contract tag changes; CI fails if regeneration changes the committed artifact. `src/api/sse.ts` consumes the authenticated `/homes/{home_id}/events/stream` contract and invalidates dashboard queries when replayable event data arrives.

After a fixed browser camera completes its relative 2D sweep, setup can submit
several still frames to `/cameras/{camera_id}/localize-roomplan`. If the active
native RoomPlan scan has a derived visual landmark index, the backend estimates
that separate camera's pose in `roomplan-local`; otherwise setup remains usable
in 2D and explains that a fresh native scan is required for 3D placement. Once
ready, the publisher sends bounded transient frames to the local object-vision
endpoint; raw frame bytes are not retained.

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

