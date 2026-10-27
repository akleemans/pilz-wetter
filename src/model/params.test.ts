import { describe, expect, test } from 'bun:test';
import { updateParamDocs } from './param-docs.ts';
import {
  DEFAULT_PARAMS,
  diffParams,
  PARAM_GROUPS,
  PARAM_KEYS,
  PARAMS,
  type ParamSpec,
  resolveParams,
} from './params.ts';

describe('parameter documentation', () => {
  test('every parameter is documented and in a known group', () => {
    for (const key of PARAM_KEYS) {
      const spec: ParamSpec = PARAMS[key];
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.description.length).toBeGreaterThan(20);
      expect(Object.keys(PARAM_GROUPS)).toContain(spec.group);
      expect(spec.step).toBeGreaterThan(0);
    }
  });

  test('list parameters label every entry', () => {
    for (const key of PARAM_KEYS) {
      const spec: ParamSpec = PARAMS[key];
      if (Array.isArray(spec.default)) {
        expect(spec.items?.length).toBe(spec.default.length);
      }
    }
  });

  test('defaults respect their own bounds', () => {
    for (const key of PARAM_KEYS) {
      const spec: ParamSpec = PARAMS[key];
      const values = typeof spec.default === 'number' ? [spec.default] : spec.default;
      for (const v of values) {
        if (spec.min !== undefined) {
          expect(v).toBeGreaterThanOrEqual(spec.min);
        }
        if (spec.max !== undefined) {
          expect(v).toBeLessThanOrEqual(spec.max);
        }
      }
    }
  });

  test('the water weights sum to 1', () => {
    const { weightMoisture, weightSustain, weightFlush } = DEFAULT_PARAMS;
    expect(weightMoisture + weightSustain + weightFlush).toBeCloseTo(1);
  });

  test('MODEL.md carries the current parameter reference', async () => {
    const path = new URL('../../MODEL.md', import.meta.url).pathname;
    const document = await Bun.file(path).text();
    // If this fails, run `bun run docs:params`.
    expect(updateParamDocs(document)).toBe(document);
  });
});

describe('resolveParams', () => {
  test('returns the defaults without overrides', () => {
    expect(resolveParams()).toEqual(DEFAULT_PARAMS);
    expect(resolveParams(null)).toEqual(DEFAULT_PARAMS);
    expect(resolveParams('nonsense')).toEqual(DEFAULT_PARAMS);
  });

  test('applies valid overrides', () => {
    const params = resolveParams({ fieldCapacity: 100, moistureRamp: [5, 30] });
    expect(params.fieldCapacity).toBe(100);
    expect(params.moistureRamp).toEqual([5, 30]);
    expect(params.retentionBase).toBe(DEFAULT_PARAMS.retentionBase);
  });

  test('drops unknown keys and values of the wrong shape', () => {
    const params = resolveParams({
      bogus: 1,
      fieldCapacity: '100',
      moistureRamp: [5],
      flushRamp: [1, Number.NaN],
      sustainWindow: Number.POSITIVE_INFINITY,
      seasonByMonth: 0.5,
    });
    expect(params).toEqual(DEFAULT_PARAMS);
  });

  test('does not share arrays with the caller', () => {
    const ramp = [5, 30];
    const params = resolveParams({ moistureRamp: ramp });
    ramp[0] = 99;
    expect(params.moistureRamp[0]).toBe(5);
  });

  test('the defaults are frozen', () => {
    expect(Object.isFrozen(DEFAULT_PARAMS)).toBe(true);
  });
});

describe('diffParams', () => {
  test('is empty for the defaults', () => {
    expect(diffParams(DEFAULT_PARAMS)).toEqual({});
  });

  test('lists only what changed, and round-trips', () => {
    const overrides = { fieldCapacity: 90, flushRamp: [6, 50] };
    const params = resolveParams(overrides);
    expect(diffParams(params)).toEqual(overrides);
    expect(resolveParams(diffParams(params))).toEqual(params);
  });
});
