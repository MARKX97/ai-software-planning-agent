# Docker Cache And Code Shape Debt

> Status: Completed — delivered 2026-08-10
> Scope: Docker dependency-layer reuse and existing Harness code-shape exceptions.

## Goal

- Keep `pnpm install` cached when only source files change.
- Remove existing max-parameter and max-function-length Harness exceptions without changing product behavior.

## Boundaries

- Do not add dependencies or change product/API contracts.
- Do not run Docker builds during implementation; use one explicit build only if final runtime verification is requested.
- Keep the single-process rate limiter until multi-instance deployment is in scope.

## Verification

- Dockerfile/Compose static validation and Harness checks.
- Focused lint, typecheck, and existing API/Web tests for refactored call sites and components.
- `pnpm verify:fast` after both workstreams are integrated.

## Results

- Docker dependency installation now depends on workspace manifests and lock/workspace files rather
  than the complete source tree; BuildKit reuses the pnpm store when dependencies change.
- Harness code-shape baselines for file length, function length, and parameter count are all empty.
- Existing API/Web behavior remains covered by lint, typecheck, deterministic tests, and Harness.
- A Docker build was intentionally not run during implementation; Compose configuration validation
  covered the static delivery change without downloading the dependency tree again.
