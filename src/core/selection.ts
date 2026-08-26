export interface SelectionResult {
  indices: Set<number>;
  quit: boolean;
  all: boolean;
}

export function parseSelection(input: string): SelectionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { indices: new Set(), quit: false, all: false };
  }

  const normalized = trimmed.replace(/,\s*/g, ' ').replace(/\s*-\s*/g, '-');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const indices = new Set<number>();
  let quit = false;
  let all = false;

  for (const token of tokens) {
    if (token === 'q') {
      quit = true;
      continue;
    }
    if (token === 'a') {
      all = true;
      continue;
    }

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        indices.add(i);
      }
      continue;
    }

    const numMatch = token.match(/^\d+$/);
    if (numMatch) {
      indices.add(parseInt(token, 10));
    }
  }

  return {
    indices: new Set([...indices].sort((a, b) => a - b)),
    quit,
    all,
  };
}
