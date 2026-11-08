import { describe, expect, it } from 'vitest';
import { fromV1, migrate } from '../src/core/macro';
import v1 from './fixtures/v1-storage.json';

describe('migrate', () => {
  it('turns every v1 collection into a v2 macro, keeping order and data', () => {
    const macros = migrate(v1.collections as never);

    expect(macros.map((m) => m.name)).toEqual(['Login', 'New Collection 2', 'Empty']);
    expect(macros[0]).toEqual({
      id: '3f1c2a9e-7b4d-4e8a-9c21-5d6f7a8b9c01',
      name: 'Login',
      delayMs: 1500,
      runs: 2,
      loop: false,
      steps: [
        {
          id: 'a1b2c3d4-0001-4000-8000-000000000001',
          action: 'type',
          label: 'email',
          value: 'me@example.com',
          secret: false,
          locators: [{ kind: 'xpath', value: '//*[@id="email"]' }],
        },
        {
          id: 'a1b2c3d4-0001-4000-8000-000000000002',
          action: 'type',
          label: 'password',
          value: 'hunter2',
          secret: true,
          locators: [{ kind: 'xpath', value: '//*[@id="password"]' }],
        },
        {
          id: 'a1b2c3d4-0001-4000-8000-000000000003',
          action: 'click',
          label: 'Sign in',
          locators: [{ kind: 'xpath', value: '/html/body/main/form/button' }],
        },
      ],
    });
    expect(macros[1]).toMatchObject({ loop: true, steps: [{ action: 'click', label: 'Docs' }] });
    expect(macros[2]?.steps).toEqual([]);
  });

  it('defaults omitted optional v1 fields', () => {
    const [macro] = migrate({ x: { id: 'x', name: 'x', steps: [{ id: 's', strategy: 'InputSendKeys' }] } } as never);
    expect(macro).toEqual({
      id: 'x', name: 'x', delayMs: 1000, runs: 1, loop: false,
      steps: [{ id: 's', action: 'type', label: '', value: '', secret: false, locators: [] }],
    });
  });

  it.each([
    ['unknown step type', { strategy: 'Goto' }, 'Unknown v1 step type: Goto'],
    ['numeric value', { strategy: 'InputSendKeys', value: 42 }, 'Invalid v1 value'],
    ['bad visibility', { strategy: 'InputSendKeys', visibility: 'secret' }, 'Invalid v1 visibility'],
    ['non-string xpath', { strategy: 'ButtonClick', xpath: 1 }, 'Invalid v1 xpath'],
    ['non-string label', { strategy: 'AClick', label: null }, 'Invalid v1 label'],
  ])('rejects %s', (_, step, message) => {
    expect(() => fromV1({ id: 'x', name: 'x', steps: [{ id: 's', ...step }] } as never)).toThrow(message);
  });

  it.each([
    ['delay', { delayBetweenSteps: '1000' }],
    ['number of runs', { numberOfRuns: null }],
    ['loop setting', { doesLoopInfinitely: 'yes' }],
  ])('rejects invalid %s', (field, settings) => {
    expect(() => fromV1({ id: 'x', name: 'x', steps: [], ...settings } as never)).toThrow(`Invalid v1 ${field}`);
  });
});
