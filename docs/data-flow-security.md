# Beacon — User Data Flow & Security

How a user's data moves through Beacon, where it lives, and how tenant isolation prevents cross-customer leaks.

> Diagrams render as SVG on GitHub. In VSCode, open with Markdown Preview (`Cmd+Shift+V`); the **Markdown Preview Mermaid Support** extension renders them inline.

---

## 1. Top-level data flow

```mermaid
flowchart TB
    User["User Browser<br/>polarispoint.io/beacon<br/>(HTTPS only)"]:::user

    subgraph Vercel["Vercel Serverless"]
        direction TB
        Auth["Auth.resolveTenant(req)<br/>verify JWT → tenant.id"]:::auth
        API["api/beacons/*<br/>stateless, ephemeral"]:::vercel
        Auth --> API
    end

    subgraph Storage["Storage Layer"]
        direction LR
        Neon[("Neon Postgres<br/>beacons_tenants<br/>beacons_items<br/>beacons_usage_log<br/>beacons_google_tokens")]:::store
        Blob[("Vercel Blob<br/>raw file uploads<br/>per-tenant path prefix")]:::store
    end

    subgraph ThirdParty["Third-Party APIs"]
        direction LR
        Anthropic["Anthropic<br/>Claude inference<br/>zero-retention*"]:::external
        Google["Google APIs<br/>Drive · Gmail · Docs<br/>user-scoped OAuth"]:::external
        OpenAI["OpenAI Whisper<br/>voice transcription<br/>no training use"]:::external
    end

    User -->|"Authorization: Bearer JWT"| API
    API -->|"WHERE tenant_id = ..."| Neon
    API -->|"path: beacons/{tenant}/..."| Blob
    API --> Anthropic
    API --> Google
    API -. "🎙 only" .-> OpenAI

    classDef user fill:#1e293b,stroke:#5b8def,color:#e2e8f0
    classDef vercel fill:#0e1422,stroke:#8b9caf,color:#e2e8f0
    classDef auth fill:#3a2f0e,stroke:#e8c547,color:#e8c547
    classDef store fill:#0a3a2a,stroke:#22c55e,color:#bbf7d0
    classDef external fill:#1a1a2e,stroke:#9b7cff,color:#c4b5fd
```

\* Anthropic's standard API retains transient logs ~30 days for abuse review; zero-retention available on enterprise agreement.

---

## 2. Per-chat trace

The path of a single chat request, showing where tenant isolation kicks in.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant Vercel as Vercel Function
    participant Neon as Neon Postgres
    participant Anthropic

    User->>Browser: Types "Draft this week's update"
    Browser->>Vercel: POST /api/beacons/chat<br/>+ JWT

    Note over Vercel: Auth.resolveTenant(req)<br/>→ tenant.id = "tenant_pete"

    Vercel->>Neon: SELECT * FROM beacons_items<br/>WHERE tenant_id='tenant_pete'
    Neon-->>Vercel: ONLY this tenant's items<br/>(directions, projects, tasks, library)

    Note over Vercel: Pre-flight checks:<br/>• budget cap<br/>• inquiry counter<br/>• tier limits resolved

    Note over Vercel: Build prompt:<br/>• system + directions<br/>• history (tier-capped)<br/>• RAG (rag_tokens × 4 chars)

    Vercel->>Anthropic: POST /v1/messages<br/>max_tokens, web_search tier-capped
    Anthropic-->>Vercel: Streaming response<br/>(usage tokens returned)
    Vercel-->>Browser: Stream chunks via SSE

    Vercel->>Neon: INSERT INTO beacons_usage_log<br/>(tenant_id, tokens, cost_usd)
    Vercel->>Neon: UPSERT thread item<br/>(server stamps tenant_id)
```

---

## 3. Storage isolation (logical multi-tenancy)

Single shared Postgres instance, but every query is scoped by `tenant_id`. The server stamps tenant_id from the verified JWT — clients can never spoof it.

```mermaid
flowchart TB
    Query["App Query<br/>WHERE tenant_id = 'tenant_pete'"]:::query

    subgraph Neon["Neon Postgres (shared instance, encrypted at rest)"]
        direction LR
        subgraph T1["tenant_pete"]
            T1S["items: 247<br/>threads: 38<br/>files: 12"]
        end
        subgraph T2["tenant_acme"]
            T2S["items: 12<br/>threads: 2<br/>files: 4"]
        end
        subgraph T3["tenant_xyz"]
            T3S["items: 891<br/>threads: 156<br/>files: 23"]
        end
    end

    Query ==scopes to==> T1
    Query x-.x cannot see .-x T2
    Query x-.x cannot see .-x T3

    classDef query fill:#3a2f0e,stroke:#e8c547,color:#e8c547,stroke-width:2px
```

**Enforcement layers** (all in code, see [api/beacons/items.js](polaris-point-demos/api/beacons/items.js)):

1. JWT verified before any DB touch — invalid token = 401
2. Reads: every `SELECT` includes `WHERE tenant_id = ${resolvedTenantId}`
3. Writes: before UPDATE, server confirms existing row's `tenant_id` matches caller's
4. No client-supplied tenant_id is trusted — the field is overwritten server-side
5. NULL tenant_id rejected as "unclaimed" — old rows can't be hijacked

---

## 4. Tenant isolation in tables

| Table | tenant_id source | Index |
|---|---|---|
| `beacons_tenants` | own `id` column (PK) | PK + email |
| `beacons_items` | server-stamped from JWT | (tenant_id, updated_at DESC) |
| `beacons_usage_log` | server-stamped from JWT | (tenant_id, created_at DESC) |
| `beacons_google_tokens` | server-stamped from JWT | (tenant_id) UNIQUE |

---

## 5. Storage at rest — encryption & access

```mermaid
flowchart LR
    subgraph DBLayer["Neon Postgres"]
        DB[("Encrypted at rest<br/>AES-256<br/>TLS in transit<br/>Pooled connection")]
    end

    subgraph BlobLayer["Vercel Blob (file uploads)"]
        BP["Path: beacons/{tenant}/{yyyy-mm}/{file}<br/>Signed upload URLs<br/>Auth: x-beacons-auth + x-beacons-tenant<br/>Hashed filenames (unguessable)"]
    end

    Vercel["Vercel Function"]:::vercel
    Vercel -->|pooled SSL| DB
    Vercel -->|signed upload| BP

    classDef vercel fill:#0e1422,stroke:#8b9caf,color:#e2e8f0
```

DB credentials live as Vercel **Sensitive** env vars — they don't appear in `vercel env pull` output, only in the runtime function process. No DB credentials in the repo.

---

## 6. Third-party data sharing

| Third party | What they see | Retention | Reason |
|---|---|---|---|
| **Anthropic** | Chat context (system + history + message) per call | Zero-retention on enterprise; standard API: transient logs ~30d for abuse review | LLM inference |
| **OpenAI (Whisper)** | Audio bytes when 🎙 Record is used | Not used for training; short-term logs | Voice → text fallback when browser dictation fails |
| **Google (Drive/Gmail/Docs)** | Only what user explicitly attaches/exports | Stored in user's own Drive (their account) | User-opted I/O |
| **Vercel** | Function metadata + DB connection traffic | ~30 days logs | Hosting + observability |
| **Stripe** (when billing enabled) | Customer email, plan, payment method | Per Stripe retention | Billing |

No customer content goes to analytics tools, error reporters, or training pipelines.

---

## 7. Data deletion & portability

- **Delete one item** → `DELETE /api/beacons/items?id=…` removes the row (tenant-scoped) and the Blob if it's a file
- **Delete whole tenant** → admin op: `DELETE FROM beacons_items WHERE tenant_id='…'` + same for `beacons_usage_log` + revoke Google tokens
- **Export** → `GET /api/beacons/items` returns all of a tenant's items as JSON (full library + threads in one dump)

---

## 8. Containerized / physical-isolation upgrade path

The current model is **logical multi-tenancy on a shared Postgres**. For customers requiring **physical isolation** (enterprise, regulated industries, sovereignty), the same codebase supports per-customer Neon projects:

```mermaid
flowchart LR
    subgraph Standard["Standard customers (shared)"]
        StdDB[("Neon Project A<br/>tenant_pete<br/>tenant_acme<br/>tenant_xyz<br/>...")]
    end

    subgraph Enterprise["Enterprise customer (physical isolation)"]
        EntDB[("Neon Project B<br/>dedicated DB<br/>tenant_bigcorp only")]
    end

    App["App Code<br/>(no changes)"]:::app
    App -->|DATABASE_URL_A| StdDB
    App -->|DATABASE_URL_BIGCORP| EntDB

    classDef app fill:#3a2f0e,stroke:#e8c547,color:#e8c547
```

Same app code path; only the connection string changes per request based on tenant tier. A `tier='enterprise'` customer maps to a dedicated DB connection. No fork of the application.

---

## 9. What's NOT here (intentionally)

- **Background workers** — none. All Beacon logic runs in request-scoped Vercel functions. No async daemons holding tenant data outside a request.
- **Caching layer** — Anthropic's ephemeral prompt cache (1h TTL) is scoped to a content hash unique per tenant. No cross-tenant cache hits.
- **CDN** — Static assets (HTML/JS/CSS) are CDN-cached. User data never is.

---

*Generated: 2026-05-15. Update when tenant isolation, third-party integrations, or storage topology changes.*
