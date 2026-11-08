import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportMacro, importMacro, migrate } from '../src/core/macro';
import v1 from './fixtures/v1-storage.json';

const v1Export = readFileSync(new URL('./fixtures/Login.em.json', import.meta.url), 'utf8');
const [login] = migrate(v1.collections as never);

describe('importMacro', () => {
  it('imports a v1 export file with a new id', () => {
    const macro = importMacro(v1Export);
    expect(macro).toEqual({ ...login, id: expect.any(String) });
    expect(macro.id).not.toBe(login!.id);
  });

  it('imports a v2 export file with a new id', () => {
    const macro = importMacro(exportMacro(login!));
    expect(macro).toEqual({ ...login, id: expect.any(String) });
    expect(macro.id).not.toBe(login!.id);
  });

  it.each([
    ['not JSON', 'nope', "This file isn't a macro file."],
    ['unrelated JSON', '{"foo":1}', "This file isn't a macro file."],
    ['bad v2 step', JSON.stringify({ version: 2, macro: { ...login, steps: [{ id: 's', label: '', locators: [], action: 'type' }] } }), "This macro file is damaged and can't be imported."],
    ['bad v1 step', JSON.stringify({ name: 'x', steps: [{ id: 's', strategy: 'Goto' }], delayBetweenSteps: 1 }), "This macro file is damaged and can't be imported."],
  ])('rejects %s', (_, text, message) => {
    expect(() => importMacro(text)).toThrow(message);
  });
});
