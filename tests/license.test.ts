// The license shown in the game (Szabályok → Licenc) must be the LICENSE file, word for word.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LICENSE_TEXT } from '../src/ui/license';

describe('the license', () => {
  it('in the game is the same as the LICENSE file', () => {
    const file = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
    expect(LICENSE_TEXT.replace(/\r\n/g, '\n')).toBe(file.replace(/\r\n/g, '\n'));
    expect(file).toContain('WITHOUT WARRANTY OF ANY KIND');
  });
});
