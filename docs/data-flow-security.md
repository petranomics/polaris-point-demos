# Beacon — User Data Flow & Security

How a user's data moves through Beacon, where it lives, and how tenant isolation prevents cross-customer leaks.

---

## 1. Top-level data flow

```
                    ┌────────────────────────────────────────────────────┐
                    │                  USER (Browser)                    │
                    │  polarispoint.io/beacon  •  HTTPS only             │
                    └────────────────────────┬───────────────────────────┘
                                             │
                                             │  JWT in localStorage
                                             │  Authorization: Bearer ...
                                             │
                    ┌────────────────────────▼───────────────────────────┐
                    │              VERCEL EDGE/SERVERLESS                │
                    │  api/beacons/*  •  stateless, ephemeral functions  │
                    │                                                    │
                    │  ┌─────────────────────────────────────────────┐   │
                    │  │  Auth.resolveTenant(req)                    │   │
                    │  │    → verifies JWT signature                 │   │
                    │  │    → returns {id, tier, allocation_pct,…}   │   │
                    │  │    → tenant.id is the security boundary     │   │
                    │  └─────────────────────────────────────────────┘   │
                    │                                                    │
                    │  Every read/write below scopes by tenant.id.       │
                    └──┬──────────────────────────────────────────┬──────┘
                       │                                          │
       ┌───────────────┘                                          └────────────┐
       │                                                                       │
       ▼                                                                       ▼
┌────────────────────┐    ┌────────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Neon Postgres     │    │  Anthropic API     │    │  Google APIs    │    │  OpenAI API    │
│  (primary store)   │    │  (LLM inference)   │    │  (OAuth, Drive, │    │  (Whisper      │
│                    │    │                    │    │   Gmail, Docs)  │    │   transcribe)  │
│  beacons_tenants   │    │  Claude Haiku/     │    │  Per-tenant     │    │  Voice notes   │
│  beacons_items     │    │   Sonnet           │    │  refresh token  │    │   only (no     │
│  beacons_usage_log │    │                    │    │  Scoped to that │    │   text history)│
│                    │    │  No data retained  │    │  user's Drive   │    │                │
│  Vercel Blob       │    │   for training     │    │                 │    │  No retention  │
│  (raw uploads)     │    │   (zero-retention  │    │                 │    │   for training │
│                    │    │   on enterprise)   │    │                 │    │                │
└────────────────────┘    └────────────────────┘    └─────────────────┘    └────────────────┘
```

---

## 2. What happens during a single chat

```
USER TYPES "Draft this week's wholesale update"
   │
   ▼
[Browser]   POST /api/beacons/chat with JWT
   │
   ▼
[Vercel]    Auth.resolveTenant(req) → tenant.id = "tenant_pete"
   │
   ▼
[Neon]      SELECT data FROM beacons_items
              WHERE tenant_id = 'tenant_pete'
              ◄── ONLY this tenant's items returned. No cross-leak possible.
   │
   ▼
[Vercel]    Build system prompt with this tenant's:
              - directions (kind='direction')
              - projects (kind='project')
              - tasks (kind='task')
              - library files + thoughts (kind='file' | 'thought')
            All capped by tier-limits.js (rag_tokens budget).
   │
   ▼
[Anthropic] POST /v1/messages
              system: tenant's context  (cache_control: ephemeral 1h)
              messages: tenant's history (history limit per tier)
              max_tokens: tier max_output cap
              tools: web_search if tier allows (max_uses tier-capped)
            ◄── Sent to Anthropic over TLS. Anthropic's API zero-retention
                policy applies (no training on this data; transient logs
                cleared per Anthropic's policy).
   │
   ▼
[Vercel]    Stream response to user.
            Log to beacons_usage_log:
              tenant_id, model, tokens, cost_usd, web_searches
            ◄── No content stored in usage log — only metrics.
   │
   ▼
[Neon]      INSERT INTO beacons_usage_log
              tenant_id='tenant_pete' ...
              Thread auto-saved to beacons_items with kind='thread'
              and tenant_id='tenant_pete'.
```

---

## 3. Tenant isolation — the security model

**Every storage table has a `tenant_id` column. Every query filters by it. The server stamps it from the verified JWT, never from client input.**

| Table | tenant_id source | Index |
|---|---|---|
| `beacons_tenants` | own `id` column (PK) | PK + email |
| `beacons_items` | server-stamped from JWT | (tenant_id, updated_at DESC) |
| `beacons_usage_log` | server-stamped from JWT | (tenant_id, created_at DESC) |
| `beacons_google_tokens` | server-stamped from JWT | (tenant_id) UNIQUE |

**Guard rails in code** (see `api/beacons/items.js`):

1. **JWT verified before any DB touch** — invalid token = 401 before tenant resolution
2. **Reads scope by tenant** — every `SELECT` has `WHERE tenant_id = ${resolvedTenantId}`
3. **Writes verify ownership** — before update, check existing row's `tenant_id` matches caller's; reject if not
4. **No client-supplied tenant_id is trusted** — the field is overwritten server-side
5. **NULL tenant_id rejected as "unclaimed"** — old rows from before isolation can't be hijacked

**Past incident addressed:** [project_neon_creds_leaked memory] shared `_directions` ID across tenants → patched to `uid()` + ownership-check on PUT. Per-tenant ID generation now enforced.

---

## 4. Storage at rest

```
┌──────────────────────────────────────────────────────────────────┐
│  Neon Postgres (managed, AWS us-east-1)                          │
│                                                                  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐    │
│   │ tenant_pete     │  │ tenant_acme     │  │ tenant_xyz    │    │
│   │  items: 247     │  │  items: 12      │  │  items: 891   │    │
│   │  threads: 38    │  │  threads: 2     │  │  threads: 156 │    │
│   │  files: 12      │  │  files: 4       │  │  files: 23    │    │
│   └────────┬────────┘  └────────┬────────┘  └───────┬───────┘    │
│            └───────────┬────────┴────────┬──────────┘            │
│                        │                 │                       │
│                  Same table.       Tenant_id-indexed queries.    │
│                  Logical isolation, not physical.                │
│                                                                  │
│  ✓ Encrypted at rest (Neon default — AES-256)                    │
│  ✓ Encrypted in transit (TLS to/from Vercel)                     │
│  ✓ Connection via pooled URL (Vercel/Neon private network)       │
│  ✓ DB credentials in Vercel env (Sensitive flag, not in repo)    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Vercel Blob (file uploads — PDFs, DOCXs, etc.)                  │
│                                                                  │
│   beacons/tenant_pete/2026-05/Q3-supplier-audit.pdf              │
│   beacons/tenant_acme/2026-05/MSA-draft.docx                     │
│   beacons/tenant_xyz/2026-04/market-report.pdf                   │
│                                                                  │
│  ✓ Path-prefix per tenant — clientPayload validated server-side  │
│  ✓ Signed upload URLs with x-beacons-auth + x-beacons-tenant     │
│  ✓ Public-read but path is unguessable (hashed filenames)        │
│  ✓ Auto-deleted when item is deleted (tenant-scoped cascade)     │
└──────────────────────────────────────────────────────────────────┘
```

**"Containerized" interpretation for Beacon:** while we use a shared Postgres instance (multi-tenant logical isolation, not per-customer physical), the boundary enforcement is at the query layer with mandatory tenant_id filters. Every code path that touches storage either takes a verified tenant_id parameter or refuses to execute. The schema is multi-app ready — adding a `tenant_id` filter elsewhere (e.g., a new feature) is the standard pattern, not the exception.

**For customers requiring physical isolation** (enterprise, regulated industries): Neon supports per-project databases. A `tier='enterprise'` customer could get their own Neon project with dedicated credentials — same code path, different DB URL — without forking the application.

---

## 5. Third-party data sharing

| Third party | What they see | Retention | Reason |
|---|---|---|---|
| **Anthropic** | Tenant's chat context (system prompt + history + message) per call | Zero-retention on enterprise/private cloud agreement; standard API retains transient logs for 30 days for abuse review | LLM inference |
| **OpenAI (Whisper)** | Audio bytes only (when user clicks 🎙 Record) | Per OpenAI's API terms — not used for training; short-term logs | Voice → text fallback when browser dictation fails |
| **Google (Drive/Gmail/Docs)** | Only what the user explicitly attaches: synced emails, opened Drive files, exports created | Stored in user's own Drive (under their Google account) | Inputs and outputs the user opted into |
| **Vercel** | Function invocation metadata + DB connection traffic | Logs retained ~30 days per Vercel policy | Hosting + observability |
| **Stripe** (when payments enabled) | Customer email, plan, payment method | Per Stripe's retention | Billing |

No customer content is sent to analytics tools, error reporters, or training pipelines.

---

## 6. Data deletion + portability

- **Delete one item** → `DELETE /api/beacons/items?id=…` removes the row (tenant-scoped) and the associated Blob if it's a file
- **Delete whole tenant** → admin op `DELETE FROM beacons_items WHERE tenant_id='…'` + same for `beacons_usage_log` + revoke Google tokens
- **Export** → all of a tenant's items can be pulled via `GET /api/beacons/items` and saved to JSON (full library + threads in one dump)

---

## 7. What's NOT in this diagram (intentionally)

- **Background workers** — none. All Beacon logic runs in request-scoped Vercel functions. No async daemons holding tenant data outside a request.
- **Caching layer** — Anthropic's ephemeral prompt cache (1h TTL) holds the system prompt + library context per call. It's scoped to the cache_control hash, which is unique per tenant's content. No cross-tenant cache hits possible.
- **CDN** — Static assets (HTML, JS, CSS) are CDN-cached. User data never is.

---

*Generated: 2026-05-15. Update this doc when the tenant isolation pattern, third-party integrations, or storage layout changes.*
