import { describe, it, expect } from 'vitest';
import { formatSize } from '../src/core/display.js';

describe('formatSize', () => {
  it('formats bytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1 KB');
    expect(formatSize(1536)).toBe('2 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1 MB');
    expect(formatSize(2621440)).toBe('3 MB');
  });

  it('formats gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1.0 GB');
    expect(formatSize(2147483648)).toBe('2.0 GB');
  });
});
