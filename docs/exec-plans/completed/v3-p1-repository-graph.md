# V3 P1 Repository Awareness And Recoverable Graph

> Status: Completed on 2026-08-03
> Scope: P1.1 PDF + public GitHub repository indexing; P1.2 recoverable deterministic LangGraph workflow.
> Prerequisite: V3 P0 Exit Gate passed in [`v3-rag-agent.md`](../completed/v3-rag-agent.md).

## Goal And Exit Gate

P1 expands project evidence to PDF and public GitHub repositories, then makes LangGraph the
default execution source for the existing nine-stage workflow while retaining a V2 runner
rollback flag. A P1 release is complete only when source citations resolve to PDF pages or
repository file/line/commit, process restart resumes the same graph run, duplicate resume is
idempotent, and V2 SSE/checkpoint/artifact behavior remains compatible.

## Constraints

- Preserve the single-agent, monolith, PostgreSQL and `LlmOrchestratorService` boundaries.
- Do not accept repository credentials, arbitrary URLs, redirects outside GitHub, symlinks,
  binary/dependency/build/lock files, or likely-secret content.
- Keep source content untrusted. P1 does not implement dynamic Agent Tools; that remains P2.
- Keep default verification Mock-only and avoid Docker image rebuilds except at the P1 exit gate.

## Dependency Decisions

- Add `@langchain/langgraph` plus its PostgreSQL checkpointer integration in `apps/api` only.
  LangGraph supplies the required interrupt/replay semantics; PostgreSQL persistence avoids a
  second datastore. Harness is updated before imports.
- Use a maintained PDF text parser in the API only. Native Node has no PDF parser, and PDF
  parsing is not safe to hand-roll. Its output is normalized before the existing chunker runs;
  its Canvas polyfill is explicit because the supported Node 20 runtime has no DOMMatrix.
- Use native `fetch` for the fixed GitHub metadata requests and one official tarball download.
  `tar-stream` validates archive entries instead of hand-rolling tar parsing; it rejects links,
  traversal and oversized content without adding OAuth or an Octokit SDK.

## P1.1 — PDF And Public Repository Indexing

1. Upgrade knowledge/API/database/frontend contracts from P1 Proposed to Contract before code.
2. Add source-type metadata, repository commit identity, file/page locators and migrations.
3. Implement PDF parsing and public GitHub snapshot import with deterministic fixtures.
4. Reuse the existing revision/indexer/retrieval pipeline; add file/line/commit citation data.
5. Cover size/type validation, SSRF/redirect rejection, traversal/symlink/binary/secret exclusion,
   project isolation, stable chunks and retrieval evaluation.

## P1.2 — Deterministic LangGraph Workflow

1. Upgrade Graph, workflow, API/database/schema/frontend contracts and Harness allowlist first.
2. Persist graph runs/checkpoint metadata and expose only sanitized status/trace summaries.
3. Map every existing stage/checkpoint to deterministic LangGraph nodes/edges, reusing current
   stage processors, SSE adapter, cost admission and artifact persistence.
4. Make the graph runner default behind an explicit V2 rollback flag; require graph-run and
   checkpoint-version preconditions for resume.
5. Cover restart/resume, duplicate resume, cancellation, state conflicts and V2 compatibility.

## Verification Strategy

- Per task: focused unit/contract tests plus `pnpm verify:fast`; use running PostgreSQL for
  database integration when schemas change.
- Per P1 subtask: targeted HTTP integration and the relevant Web E2E path; no Docker rebuild.
- Exit gate: `pnpm verify`, current-service real HTTP/PostgreSQL integration, full Web E2E, then
  one Docker production-image verification.

## Risks And Rollback

- GitHub rate limits and unavailable public sources return sanitized import failures; no partial
  active revision replaces a known-good source.
- The graph runner remains switchable to V2 until P1 Exit Gate passes. Checkpoint data is
  additive and never substitutes user-visible workflow/audit tables.

## Result

- PDF embedded text and public GitHub snapshots use the existing revision/index pipeline;
  citations preserve PDF pages or repository file/line/immutable-commit locators.
- The nine-stage workflow now defaults to persistent LangGraph interrupts and checkpoint resume;
  stale versions are atomically rejected before messages, executions, logs or cost can change.
- `WORKFLOW_RUNNER=v2` preserves the old runner and request shape as an operational rollback.
- `pnpm verify` passed; real PostgreSQL recovery and full HTTP workflow integration passed 2/2;
  Chromium/Firefox/WebKit E2E passed 15/15; the production API/Web containers are healthy.
- A live unauthenticated GitHub smoke was unavailable because the environment returned HTTP 403
  with `x-ratelimit-remaining=0`; deterministic archive, URL, commit and locator tests passed.
- Real Baishan and real Embedding calls remained disabled; default verification was Mock-only.
