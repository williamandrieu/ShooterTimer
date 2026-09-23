import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

function importsOf(source: string): string[] {
  const matches = source.matchAll(/from ['"]([^'"]+)['"]/g);
  return [...matches].map((match) => match[1] ?? '');
}

describe('architecture boundaries', () => {
  it('keeps domain free of outer layers and react', () => {
    for (const file of walk('src/domain')) {
      const source = readFileSync(file, 'utf8');
      for (const spec of importsOf(source)) {
        expect(spec === 'react' || spec.startsWith('react/')).toBe(false);
        expect(spec.includes('/infra/')).toBe(false);
        expect(spec.includes('/ui/')).toBe(false);
        expect(spec.includes('/application/')).toBe(false);
        expect(spec.includes('/hooks/')).toBe(false);
      }
    }
  });

  it('keeps application free of infra', () => {
    for (const file of walk('src/application')) {
      const source = readFileSync(file, 'utf8');
      for (const spec of importsOf(source)) {
        expect(spec.includes('/infra/')).toBe(false);
      }
    }
  });

  it('keeps ui free of infra', () => {
    for (const file of walk('src/ui')) {
      const source = readFileSync(file, 'utf8');
      for (const spec of importsOf(source)) {
        expect(spec.includes('/infra/')).toBe(false);
      }
    }
  });
});
