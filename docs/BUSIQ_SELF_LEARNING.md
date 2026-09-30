# BUSIQ Self-Learning Architecture

BUSIQ will improve from evidence and evaluation rather than silently rewriting its own code or model weights.

## No-paid-first strategy

The model layer is provider-agnostic. BUSIQ can use an OpenAI-compatible endpoint without taking a dependency on a paid vendor.

For development, the first zero-cost path is a local Ollama model. The BUSIQ adapter uses the OpenAI-compatible chat-completions contract, so the same intelligence contract does not change when the provider changes.

Production does not claim a model is connected until an actual reachable provider and credentials are configured.

## What "BUSIQ trains itself" means

BUSIQ's self-learning loop is:

1. Observe a request, context, answer and outcome.
2. Critique the answer with deterministic checks and an evaluator model.
3. Turn strong corrections and benchmark cases into versioned learning examples.
4. Generate candidate reasoning rules from those examples.
5. Gate candidates on factuality, usefulness, safety and groundedness.
6. Promote only passing candidates.
7. Version and retire rules so changes are reversible.
8. Feed approved learning material back into retrieval and prompting.
9. Re-run a fixed benchmark after every promotion.

This is self-improvement of BUSIQ's knowledge, retrieval and behavior layer. It is not autonomous retraining of a foundation model's weights.

## Safety boundary

A model may propose new knowledge or behavior, but it must not rewrite production code, authorization rules, database policies or safety constraints merely because it generated a proposal.

The deterministic promotion gate remains outside the model.

## Current implementation

- src/providers/openai-compatible.ts — provider adapter.
- src/learning/types.ts — learning data contracts.
- src/learning/engine.ts — deterministic quality and promotion gates.
- src/learning/*.test.ts — rejection and promotion tests.

## Next runtime layer

The next persistence migration should add durable learning examples, evaluations and active rules in Supabase with business isolation and RLS. Then BUSIQ can run a local/free teacher-evaluator loop against Ollama and use approved learning material in the intelligence pipeline.

No paid model is required for the architecture to work.
