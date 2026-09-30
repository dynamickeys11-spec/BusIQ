# BUSIQ Build Gate

This branch builds BUSIQ in four capability gates. A source contract is not treated as a live capability until its runtime is verified.

## Gate A — Core platform

Implemented in the repository:
- guest-first application flow
- Supabase anonymous-session path
- permanent account path
- server-side intelligence boundary
- business tenancy and RLS foundation
- durable Work / Library / context / intelligence history
- database-backed authenticated/guest-session rate limiting
- CI and production build workflow
- PWA source configuration

Runtime gates still required:
- enable Supabase anonymous sign-ins
- exact deployment READY verification
- guest Ask BUSIQ smoke test
- sign-up/sign-in smoke test
- business create/select/isolation smoke test
- reload persistence smoke test
- PWA install/offline/update smoke test

## Gate B — Real intelligence

Repository foundation now includes:
- Ollama/OpenAI-compatible model provider
- Supabase Edge inference bridge for self-hosted/local Ollama
- evidence-bounded model answer layer
- model evaluator
- learning semantic retrieval
- permission-aware business knowledge semantic retrieval
- free web research provider
- source extraction
- evidence integration and verification
- deterministic benchmark suite
- model failure fallback to deterministic intelligence

Runtime gates still required:
- Ollama model actually running
- real inference through BUSIQ
- real research retrieval
- real source extraction
- evaluator run
- benchmark execution
- migration/runtime verification

## Gate C — Business understanding

Repository foundation now includes:
- normalized customer data
- sales
- money/expenses
- products
- inventory
- suppliers
- people
- operations
- projects
- marketing
- connector registry
- CSV import
- business-data retrieval
- knowledge documents/chunks
- embeddings
- semantic business knowledge retrieval

Still required:
- actual OAuth/API connectors
- credential lifecycle
- synchronization workers
- PDF/DOCX extraction
- background document processing

## Gate D — Decide → Act → Observe → Learn

Repository foundation now includes:
- decision objects
- options
- assumptions
- scenarios
- confirmation state
- action preview
- action authorization checks
- configurable HTTPS action provider
- durable action-event schema
- server-only audit boundary
- outcome recording

Execution remains deliberately gated until:
- server-only Supabase secret is configured
- action provider endpoint is configured
- durable audit is live and verified
- a real provider execution is smoke-tested

## Autonomy

Autonomy is not enabled by default.

All required gates must pass before proactive/background intelligence can be activated:
- permanent account
- business workspace
- real model
- research
- business data
- durable action audit
- real action provider
- outcome tracking
- benchmark pass

No model is permitted to modify BUSIQ code, RLS, authorization or safety boundaries.
