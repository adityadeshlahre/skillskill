import { describe, it, expect } from 'vitest';
import { parseSelection } from '../src/core/selection.js';

describe('parseSelection', () => {
  it('parses exact numbers', () => {
    const result = parseSelection('1,3,5');
    expect(result.indices).toEqual(new Set([1, 3, 5]));
    expect(result.quit).toBe(false);
    expect(result.all).toBe(false);
  });

  it('parses ranges', () => {
    const result = parseSelection('2-5');
    expect(result.indices).toEqual(new Set([2, 3, 4, 5]));
  });

  it('parses mixed numbers and ranges', () => {
    const result = parseSelection('1,3-7,12');
    expect(result.indices).toEqual(new Set([1, 3, 4, 5, 6, 7, 12]));
  });

  it('handles "a" for select all', () => {
    const result = parseSelection('a');
    expect(result.all).toBe(true);
    expect(result.quit).toBe(false);
  });

  it('handles "q" for quit', () => {
    const result = parseSelection('q');
    expect(result.quit).toBe(true);
    expect(result.indices.size).toBe(0);
  });

  it('deduplicates numbers', () => {
    const result = parseSelection('1,1,3,3');
    expect(result.indices).toEqual(new Set([1, 3]));
  });

  it('sorts indices numerically', () => {
    const result = parseSelection('5,1,3');
    expect([...result.indices]).toEqual([1, 3, 5]);
  });

  it('rejects empty input', () => {
    const result = parseSelection('');
    expect(result.indices.size).toBe(0);
    expect(result.quit).toBe(false);
    expect(result.all).toBe(false);
  });

  it('rejects invalid tokens', () => {
    const result = parseSelection('abc');
    expect(result.indices.size).toBe(0);
  });

  it('handles whitespace around tokens', () => {
    const result = parseSelection(' 1 , 3 - 5 ');
    expect(result.indices).toEqual(new Set([1, 3, 4, 5]));
  });

  it('handles ranges that exceed item count (no validation here)', () => {
    const result = parseSelection('1-100');
    expect(result.indices.size).toBe(100);
  });

  it('handles "a" combined with numbers', () => {
    const result = parseSelection('a 1');
    expect(result.all).toBe(true);
    expect(result.indices).toEqual(new Set([1]));
  });
});
