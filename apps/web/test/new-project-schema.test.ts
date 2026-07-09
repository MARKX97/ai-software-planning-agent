import { describe, expect, it } from 'vitest';
import { newProjectSchema } from '../src/components/project/new-project-client';

describe('newProjectSchema', () => {
  it('requires name and original idea', () => {
    const result = newProjectSchema.safeParse({ name: '', original_idea: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual([
        'name',
        'original_idea',
      ]);
    }
  });

  it('accepts valid project input', () => {
    expect(
      newProjectSchema.safeParse({
        name: 'Planning Agent',
        original_idea: 'Help founders turn rough software ideas into plans.',
      }).success,
    ).toBe(true);
  });
});
