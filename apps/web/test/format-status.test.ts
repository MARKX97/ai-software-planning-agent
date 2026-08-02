import { describe, expect, it } from 'vitest';
import { stageName, statusName } from '../src/components/project/project-status';
import { statusVariant } from '../src/components/ui/badge';
import { formatBytes, formatCurrency, formatDateTime, formatNumber } from '../src/lib/format';

describe('display formatters', () => {
  it('formats missing dates, byte boundaries, numbers and currency', () => {
    expect(formatDateTime(null)).toBe('未记录');
    expect(formatDateTime('2026-01-01T00:00:00.000Z')).not.toBe('未记录');
    expect([
      formatBytes(0),
      formatBytes(1023),
      formatBytes(1024),
      formatBytes(1024 * 1024),
    ]).toEqual(['0 B', '1023 B', '1 KB', '1 MB']);
    expect(formatNumber(1234)).toContain('1');
    expect(formatCurrency(1.25)).toContain('1.25');
  });

  it('maps known statuses and safely falls back for unknown values', () => {
    expect(statusName('completed')).toBe('已经收好');
    expect(stageName('risk_analysis')).toBe('提前找找坑');
    expect(statusName('custom')).toBe('custom');
    expect(stageName('custom')).toBe('custom');
    expect(statusVariant('success')).toBe('success');
    expect(statusVariant('timeout')).toBe('danger');
    expect(statusVariant('running')).toBe('active');
    expect(statusVariant('pending')).toBe('neutral');
  });
});
