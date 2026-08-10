import assert from 'node:assert/strict';
import { it } from 'node:test';
import { toGraphRunResponse } from '../../src/modules/workflow/graph/graph-run.dto.js';

it('exposes only the redacted Tool trace summary', () => {
  const response = toGraphRunResponse({
    id: 'run-1',
    project_id: 'project-1',
    execution_id: 'execution-1',
    thread_id: 'thread-1',
    status: 'completed',
    current_node: 'end',
    current_stage: 'completed',
    waiting_for: null,
    checkpoint_version: 2,
    error_message: null,
    started_at: new Date(0),
    completed_at: new Date(1),
    created_at: new Date(0),
    updated_at: new Date(1),
    tool_steps: [
      {
        id: 'step-1',
        graph_run_id: 'run-1',
        execution_id: 'execution-1',
        node: 'choose_action',
        stage: 'planning_generation',
        tool: 'readSource',
        call_number: 1,
        status: 'success',
        arguments_json: { redacted: 'must-not-leak' },
        result_json: { summary: '读取 1 个片段', context: 'must-not-leak' },
        result_count: 1,
        duration_ms: 3,
        error_code: null,
        created_at: new Date(0),
        updated_at: new Date(1),
      },
    ],
  } as never);
  assert.equal(response?.tool_steps[0]?.summary, '读取 1 个片段');
  assert.doesNotMatch(JSON.stringify(response), /must-not-leak/);
});
