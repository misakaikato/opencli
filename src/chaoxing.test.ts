import { describe, expect, it } from 'vitest';
import { formatTimestamp, workStatusLabel } from './chaoxing.js';

describe('formatTimestamp', () => {
  it('formats millisecond timestamp', () => {
    // 2026-01-15 08:30 UTC+8
    const ts = new Date('2026-01-15T00:30:00Z').getTime();
    const result = formatTimestamp(ts);
    expect(result).toMatch(/2026-01-15/);
  });

  it('formats second timestamp', () => {
    const ts = Math.floor(new Date('2026-06-01T12:00:00Z').getTime() / 1000);
    const result = formatTimestamp(ts);
    expect(result).toMatch(/2026-06-01/);
  });

  it('returns empty for null/undefined/0', () => {
    expect(formatTimestamp(null)).toBe('');
    expect(formatTimestamp(undefined)).toBe('');
    expect(formatTimestamp(0)).toBe('');
    expect(formatTimestamp('')).toBe('');
  });

  it('passes through readable date strings', () => {
    expect(formatTimestamp('2026-03-20 23:59')).toBe('2026-03-20 23:59');
  });
});

describe('workStatusLabel', () => {
  it('maps numeric status codes', () => {
    expect(workStatusLabel(0)).toBe('未交');
    expect(workStatusLabel(1)).toBe('已交');
    expect(workStatusLabel(2)).toBe('已批阅');
  });

  it('passes through string status', () => {
    expect(workStatusLabel('已交')).toBe('已交');
  });

  it('returns 未知 for empty/null', () => {
    expect(workStatusLabel(null)).toBe('未知');
    expect(workStatusLabel('')).toBe('未知');
  });
});
