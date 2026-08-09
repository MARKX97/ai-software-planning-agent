# V3 P2 Controlled Tools And Incremental Regeneration

> Status: Active
> Scope: P2 controlled read-only Agent Tools, auditable trace, and source-aware incremental artifact regeneration.

## Goal

Complete the remaining V3 P2 scope without introducing another workflow, worker, or Agent. The
existing LangGraph runner remains authoritative; P2 adds one controlled action-selection node,
four read-only tools, a durable tool audit trail, and server-derived incremental regeneration.

## Boundaries

- Keep the system single-Agent and keep all Chat calls behind `LlmOrchestratorService`.
- Tools are a fixed whitelist: `searchKnowledge`, `readSource`, `inspectRepository`, `getArtifact`.
- Tool inputs use shared Zod schemas. The server rejects a mismatched model-supplied project ID,
  then executes only with the authenticated route project ID.
- Each stage may execute at most three tools. Every attempted call is audited and replayed by its
  `graph_run_id + stage + call_number` key.
- Source and repository content remains untrusted, redacted, and length-limited before it reaches a
  stage prompt. Tools cannot write data, advance workflow state, or call a model.
- `AGENT_ACTIONS_ENABLED=false` restores the P1 fixed-retrieval Graph path.
- No queue or worker is added. Regeneration reuses the existing planning-generation Graph stage.

## Contract And Data Changes

1. Promote `agent-graph.spec.md` and `knowledge-base.spec.md` to P2 Contract.
2. Add `tool_steps` for the durable, idempotent audit trail.
3. Extend workflow status with redacted Tool trace and the current regeneration impact.
4. Add `POST /projects/{project_id}/workflow/regenerate`; the server computes the target artifact
   set and rejects concurrent or unnecessary runs.

## Implementation

### P2.1 Controlled Tool Orchestration

1. Add the shared structured Action union and strict schemas for all four Tool inputs.
2. Insert `choose_action` before each stage when P2 is enabled and project evidence exists.
3. Select at most three actions in one structured model response; retry malformed output once.
4. Execute Tool reads through one service that validates ownership, safe paths, call count, and
   replay keys, then stores a redacted audit result.
5. Inject Tool results into the existing stage prompt as `untrusted-context`.

### P2.2 Trace And Incremental Regeneration

1. Return the latest Graph run's Tool calls, retrieval summary, and interrupt reason from the
   existing workflow status endpoint.
2. Compute stale artifacts from active source revisions, citation snapshots, source creation time,
   and the small artifact dependency graph; do not persist a second stale-state model.
3. Regenerate only the server-computed affected types. Existing unaffected artifact rows and files
   remain untouched.
4. Show the redacted trace and regeneration action in the existing workflow status panel.

## Verification

- During implementation: focused shared-schema, Tool security, Graph routing, impact calculation,
  selected-artifact generation, API contract, and Web component tests only.
- Exit gate: one `pnpm verify`, PostgreSQL HTTP/Graph integration, full Web E2E, and one production
  container smoke after all P2 work is complete. Real Baishan and Embedding remain explicit opt-in.

## Completion Criteria

- Unknown Tool, mismatched project ID, unsafe path, Prompt Injection action, and call four are all
  rejected before a Tool read.
- Tool failure is audited and degrades without executing source instructions.
- Tool trace is redacted and correlates to Graph run, stage, execution, and model cost records.
- Regeneration changes only affected artifact types; replay and duplicate requests do not duplicate
  Tool audit rows, active artifacts, model logs, or cost.
- Contracts, migration, deterministic tests, full verification, and UI E2E agree.
