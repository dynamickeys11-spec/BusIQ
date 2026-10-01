# BUSIQ API Contract & Readiness Matrix

Branch: `feat/intelligence-core`  
Audit commit: `f088a13e2f8a44e9bf12f713d8b06e643bcf6bf2`

## Contract rules

- BUSIQ owns stable application-level contracts.
- Supabase is an implementation provider for identity, database persistence, RLS and selected backend functions.
- External AI, research and connector providers must sit behind provider interfaces; provider-specific APIs must not leak through the product contract.
- Every authenticated business operation is business-scoped.
- Guest intelligence is allowed through an anonymous Supabase Auth session; guests cannot access business workspaces or business-private memory.
- Persistent business infrastructure requires a permanent account.
- Read operations and write/action operations are separate.
- Action execution requires preview, confirmation and durable audit.
- A capability is not considered production-ready merely because a TypeScript interface exists.

## Status vocabulary

- **GREEN — implemented**: code and/or database contract exists in the repository.
- **YELLOW — foundation**: contract exists but live runtime/provider verification is incomplete.
- **RED — missing**: no production implementation exists.
- **N/A — provider-owned**: BUSIQ should consume the provider rather than reproduce its API.

## Current application endpoints

| Endpoint | Method | Status | Evidence |
|---|---:|---|---|
| `/api/health` | GET | GREEN | `api/health.ts` |
| `/api/backend-status` | GET | YELLOW | `api/backend-status.ts`; readiness payload is stale and must be updated |
| `/api/intelligence` | POST | YELLOW | `api/intelligence.ts`; guest-safe and authenticated paths share the secure API boundary; authenticated business requests are scoped, rate-limited and persisted; live model/research runtime remains a release gate |
| `/api/auth` | — | N/A | `api/auth.ts` is an authentication helper, not a complete public auth route; client auth uses Supabase Auth directly |

## Identity domain

| Capability | Contract | Status |
|---|---|---|
| Sign up | Supabase Auth client | GREEN foundation |
| Sign in | Supabase Auth client | GREEN foundation |
| Session | Supabase Auth client | GREEN foundation |
| Sign out | Supabase Auth client | GREEN foundation |
| Guest session | Supabase anonymous Auth session | GREEN foundation |
| Guest-to-account upgrade | Supabase identity linking / account flow | YELLOW |
| Password reset | Supabase Auth | RED |
| Magic link / OTP | Supabase Auth | RED |
| Social/SSO | Supabase Auth | RED |

The application should not invent duplicate authentication endpoints unless a server-side requirement appears.

## Business domain

| Capability | Contract | Status |
|---|---|---|
| List businesses | Supabase Data API / RLS | GREEN |
| Create business | `create_business` + RLS | GREEN |
| Business membership | Supabase Data API / RLS | GREEN |
| Business authorization | `/api/intelligence` boundary | GREEN |
| Business profile update API | Future application contract | RED |
| Member management API | Future application contract | RED |

## Workspace domain

| Capability | Contract | Status |
|---|---|---|
| Work read | `work_items` via Supabase | GREEN |
| Work create | `work_items` via Supabase | GREEN |
| Work complete | `work_items` via Supabase | GREEN |
| Work archive | Database state exists; UI/API contract incomplete | YELLOW |
| Work delete | RLS policy exists; UI/API contract incomplete | YELLOW |
| Library read | `library_items` via Supabase | GREEN |
| Library create | `library_items` via Supabase | GREEN |
| Library update | RLS policy exists; UI/API contract incomplete | YELLOW |
| Library delete | RLS policy exists; UI/API contract incomplete | YELLOW |
| Business context read/write | `business_context` via Supabase | GREEN |
| Intelligence history write | Server-side `/api/intelligence` | GREEN |
| Intelligence history read | `intelligence_runs` via Supabase | GREEN |

## Intelligence domain

| Capability | Contract | Status |
|---|---|---|
| Request intelligence | `POST /api/intelligence` | YELLOW |
| Intent resolution | Internal pipeline | GREEN |
| Ambiguity handling | Internal pipeline | GREEN |
| Context assembly | Internal pipeline | GREEN |
| Capability routing | Internal pipeline | GREEN |
| Planning | Internal pipeline | GREEN |
| Evidence model | Internal pipeline | GREEN |
| Verification | Internal pipeline | GREEN |
| Answer-quality validation | Internal pipeline | GREEN |
| Production/local model provider | `ModelProvider` + Ollama/Supabase Edge adapter | YELLOW |
| Live web research | Free web research provider | YELLOW |
| Web search | DuckDuckGo HTML adapter | YELLOW |
| Source retrieval/extraction | Server-side research extractor | YELLOW |
| External claim verification | Evidence verification pipeline | YELLOW |
| Streaming intelligence | Future | RED |

## Knowledge domain

| Capability | Contract | Status |
|---|---|---|
| Text/Markdown/CSV/JSON ingestion | `POST /api/knowledge` | YELLOW |
| File upload | Storage contract | YELLOW foundation |
| Document extraction | Processing contract | YELLOW foundation; PDF/DOCX worker still required |
| Chunking | Knowledge pipeline | GREEN foundation |
| Embeddings | Supabase `busiq-embed` | GREEN foundation |
| Semantic retrieval | `match_knowledge_chunks` | GREEN foundation |
| Business knowledge index | Permission-aware knowledge chunks | YELLOW |

## Connector domain

BUSIQ should expose a stable connector contract rather than expose provider-specific APIs to the intelligence engine.

| Capability | Status |
|---|---|
| Connector registry | YELLOW foundation |
| OAuth/credential lifecycle | RED |
| Connector health | YELLOW foundation |
| Connector sync | RED |
| CSV business-data import | YELLOW |
| Normalized sales data | YELLOW |
| Normalized customer data | YELLOW |
| Normalized financial data | YELLOW |
| Normalized product data | YELLOW |
| Normalized inventory data | YELLOW |
| Normalized marketing data | YELLOW |
| Normalized operations data | YELLOW |
| Inbound webhooks | RED |

## Action domain

| Capability | Status |
|---|---|
| Action model | GREEN |
| Action safety checks | GREEN |
| Action preview | YELLOW foundation |
| User confirmation | YELLOW foundation |
| Durable action execution | YELLOW foundation; requires server secret + configured provider |
| Provider adapters | YELLOW — configurable HTTPS webhook provider |
| Durable action audit storage | YELLOW — schema + server-only audit boundary |
| Action history API | RED |

## Platform domain

| Capability | Status |
|---|---|
| Request validation | GREEN |
| Authentication boundary | GREEN |
| Business authorization | GREEN |
| Distributed rate limiting | GREEN foundation |
| Rate-limit failure handling | GREEN |
| Durable cache | RED |
| Background job queue | YELLOW foundation — schema exists; worker/cron still required |
| Job status API | RED |
| Usage accounting | YELLOW foundation |
| Billing API | RED |
| Dependency health checks | YELLOW |
| Observability/tracing | YELLOW |

## PWA domain

| Capability | Status |
|---|---|
| Manifest source | GREEN |
| Service worker generation config | GREEN |
| Offline navigation strategy | GREEN foundation |
| Installed runtime verification | YELLOW |
| Offline behavior verification | YELLOW |
| Update lifecycle verification | YELLOW |

## Production gate

BUSIQ must not merge `feat/intelligence-core` to `main` until all critical gates are verified:

1. Current CI passes on the exact release commit.
2. Current Vercel deployment is READY.
3. Supabase migrations match the repository.
4. Security Advisor has no actionable findings.
5. Auth runtime is tested.
6. Business creation/selection/isolation is tested.
7. Work, Library, Context and intelligence history survive reload.
8. PWA install/service-worker behavior is browser-verified.
9. No client path bypasses the authenticated intelligence boundary.
10. Production model/research providers are either connected or the release is explicitly classified as a foundation release rather than a full intelligence release.
11. No merge to `main` before these gates pass.

## Immediate build order

1. Enable and verify Supabase anonymous sign-ins for guest-first access.
2. Verify CI and Vercel on the current commit.
3. Complete runtime auth/business/persistence/PWA verification.
4. Run real Ollama inference through the BUSIQ model path.
5. Verify free research retrieval, extraction and evidence verification.
6. Apply and verify normalized business-data + knowledge migrations.
7. Verify CSV business-data import and semantic business retrieval.
8. Configure and verify the durable action audit secret and action provider.
9. Add PDF/DOCX extraction worker and background job processing.
10. Build real OAuth connectors, outcome calibration and benchmark gates.
11. Re-run the complete readiness audit before release.

## Important architectural boundary

The browser should not call external AI, search, connector or action providers directly.

Preferred flow:

Browser -> BUSIQ API -> authenticated business scope -> intelligence/orchestration -> provider adapter -> evidence/verification -> durable result.

Supabase remains an infrastructure provider underneath the BUSIQ contract rather than becoming the product's public conceptual API.
