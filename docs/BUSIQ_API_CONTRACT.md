# BUSIQ API Contract & Readiness Matrix

Branch: `feat/intelligence-core`  
Audit commit: `f088a13e2f8a44e9bf12f713d8b06e643bcf6bf2`

## Contract rules

- BUSIQ owns stable application-level contracts.
- Supabase is an implementation provider for identity, database persistence, RLS and selected backend functions.
- External AI, research and connector providers must sit behind provider interfaces; provider-specific APIs must not leak through the product contract.
- Every authenticated business operation is business-scoped.
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
| `/api/intelligence` | POST | YELLOW | `api/intelligence.ts`; authenticated, business-scoped, rate-limited and durably persisted, but deterministic intelligence is not yet backed by a production model/research provider |
| `/api/auth` | — | N/A | `api/auth.ts` is an authentication helper, not a complete public auth route; client auth uses Supabase Auth directly |

## Identity domain

| Capability | Contract | Status |
|---|---|---|
| Sign up | Supabase Auth client | GREEN foundation |
| Sign in | Supabase Auth client | GREEN foundation |
| Session | Supabase Auth client | GREEN foundation |
| Sign out | Supabase Auth client | GREEN foundation |
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
| Production model provider | `ModelProvider` abstraction needed | RED |
| Live web research | `ResearchProvider` abstraction needed | RED |
| Web search | Provider adapter needed | RED |
| Source retrieval/extraction | Provider/service adapter needed | RED |
| External claim verification | Provider/service adapter needed | RED |
| Streaming intelligence | Future | RED |

## Knowledge domain

| Capability | Contract | Status |
|---|---|---|
| File upload | Storage contract | RED |
| Document extraction | Processing contract | RED |
| Chunking | Knowledge pipeline | RED |
| Embeddings | Embedding provider interface | RED |
| Semantic retrieval | Knowledge search contract | RED |
| Business knowledge index | Knowledge pipeline | RED |

## Connector domain

BUSIQ should expose a stable connector contract rather than expose provider-specific APIs to the intelligence engine.

| Capability | Status |
|---|---|
| Connector registry | RED |
| OAuth/credential lifecycle | RED |
| Connector health | RED |
| Connector sync | RED |
| Normalized sales data | RED |
| Normalized customer data | RED |
| Normalized financial data | RED |
| Normalized product data | RED |
| Normalized inventory data | RED |
| Normalized marketing data | RED |
| Normalized operations data | RED |
| Inbound webhooks | RED |

## Action domain

| Capability | Status |
|---|---|
| Action model | GREEN |
| Action safety checks | GREEN |
| Action preview | YELLOW |
| User confirmation | YELLOW |
| Durable action execution | RED |
| Provider adapters | RED |
| Durable action audit storage | RED |
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
| Background job queue | RED |
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

1. Correct the stale backend-status contract.
2. Verify CI and Vercel on the current commit.
3. Complete runtime auth/business/persistence/PWA verification.
4. Add the production model-provider interface and adapter.
5. Add the research/search provider interface and adapter.
6. Add evidence/source persistence where required.
7. Add connector framework.
8. Add action execution only after connector and confirmation infrastructure are proven.
9. Add background jobs/cache/knowledge indexing.
10. Re-run the complete readiness audit before release.

## Important architectural boundary

The browser should not call external AI, search, connector or action providers directly.

Preferred flow:

Browser -> BUSIQ API -> authenticated business scope -> intelligence/orchestration -> provider adapter -> evidence/verification -> durable result.

Supabase remains an infrastructure provider underneath the BUSIQ contract rather than becoming the product's public conceptual API.
