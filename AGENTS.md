# BUSIQ Engineering Rules

## Authority order

1. Product Constitution — WHY / WHAT
2. Intelligence Framework — HOW IT THINKS
3. Intelligence Experience Framework — HOW IT SPEAKS
4. Design System — HOW IT LOOKS
5. Architecture and Experience Architecture
6. Builder/engineering guidance

Lower-level implementation must not redefine higher-level product decisions.

## Permanent implementation rules

1. Every phase must be demonstrable.
2. Intelligence is a reasoning layer, not a UI layer.
3. Every intelligence-ready component must support evidence, confidence, assumptions, recommendations, explanation, expandable detail, and future live updates.
4. Progressive disclosure is universal.
5. Design for capabilities that do not yet exist.
6. Workspace comes before navigation.
7. Everything teaches.
8. Keep the system model-agnostic.
9. Every decision should reduce cognitive load; when two options are equivalent, prefer the calmer one.
10. Ask: "Does this make BUSIQ feel more like an intelligent Business Intelligence Operating System?" If not, redesign or postpone.

## Negative constraints

BUSIQ is not:

- a dashboard
- an assistant
- a collection of disconnected modules
- a model selector
- a KPI tile grid
- a bespoke insight-markup system

## Accessibility

Keyboard operation, visible focus, screen-reader semantics, 44px minimum targets, meaning not conveyed by colour alone, dynamic viewport sizing, and reduced-motion support are standing requirements.

## Change discipline

Do not silently replace or overwrite product authority. Add versioned documents and update CHANGELOG.md when a binding product decision changes.
