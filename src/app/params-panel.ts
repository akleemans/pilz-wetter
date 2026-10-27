/**
 * The "Modellparameter" panel: every model parameter as a form field, grouped
 * and documented, generated from `PARAMS`. Changes apply live and are kept in
 * localStorage; the panel can copy the changed values as JSON and take JSON
 * pasted in, so tweaks can travel between reviewers and the code.
 */

import {
  DEFAULT_PARAMS,
  diffParams,
  type ModelParams,
  PARAM_GROUPS,
  PARAM_KEYS,
  type ParamKey,
  PARAMS,
  type ParamSpec,
  resolveParams,
} from '../model/params.ts';
import { loadParams, onParamsChangedElsewhere, saveParams } from './state.ts';

const APPLY_DELAY_MS = 200;

const formatDefault = (value: number | ReadonlyArray<number>) =>
  (typeof value === 'number' ? [value] : value).map((v) => String(v).replace('.', ',')).join(' / ');

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export class ParamsPanel {
  private params: ModelParams;
  private readonly inputs = new Map<ParamKey, Array<HTMLInputElement>>();
  private readonly rows = new Map<ParamKey, HTMLElement>();
  private readonly summaryCount: HTMLElement;
  private readonly message: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly onChange: (params: ModelParams) => void,
  ) {
    this.params = loadParams();
    this.summaryCount = root.querySelector('[data-params-count]')!;
    this.message = el('p', { className: 'params-message', role: 'status' });
    this.build();
    this.sync();

    onParamsChangedElsewhere((params) => {
      this.params = params;
      this.sync();
      this.onChange(params);
    });
  }

  get current(): ModelParams {
    return this.params;
  }

  private build() {
    const body = this.root.querySelector<HTMLElement>('[data-params-body]')!;

    const actions = el(
      'div',
      { className: 'params-actions' },
      el('button', {
        type: 'button',
        className: 'toggle',
        textContent: 'Alle zurücksetzen',
        onclick: () => this.reset(),
      }),
      el('button', {
        type: 'button',
        className: 'toggle',
        textContent: 'Änderungen als JSON kopieren',
        onclick: () => void this.copy(),
      }),
    );

    const textarea = el('textarea', {
      className: 'params-json',
      rows: 3,
      placeholder: '{"fieldCapacity": 100, "flushRamp": [6, 36]}',
      spellcheck: false,
    });
    textarea.setAttribute('aria-label', 'Parameter als JSON');
    const paste = el(
      'details',
      { className: 'params-paste' },
      el('summary', { textContent: 'JSON einfügen' }),
      textarea,
      el('button', {
        type: 'button',
        className: 'toggle',
        textContent: 'Übernehmen',
        onclick: () => this.applyJson(textarea.value),
      }),
    );

    const groups = Object.entries(PARAM_GROUPS).map(([group, title]) => {
      const keys = PARAM_KEYS.filter((k) => PARAMS[k].group === group);
      return el(
        'fieldset',
        { className: 'params-group' },
        el('legend', { textContent: title }),
        ...keys.map((k) => this.field(k)),
      );
    });

    body.append(actions, paste, this.message, ...groups);
  }

  private field(key: ParamKey): HTMLElement {
    const spec: ParamSpec = PARAMS[key];
    const values = typeof spec.default === 'number' ? [spec.default] : spec.default;
    const id = `param-${key}`;

    const inputs = values.map((_, i) => {
      const input = el('input', {
        type: 'number',
        id: i === 0 ? id : `${id}-${i}`,
        step: String(spec.step),
        inputMode: 'decimal',
      });
      if (spec.min !== undefined) {
        input.min = String(spec.min);
      }
      if (spec.max !== undefined) {
        input.max = String(spec.max);
      }
      if (spec.items) {
        input.setAttribute('aria-label', `${spec.label}: ${spec.items[i]}`);
      }
      input.addEventListener('input', () => this.schedule(key));
      return input;
    });
    this.inputs.set(key, inputs);

    const fields = el(
      'div',
      { className: `param-inputs${values.length > 4 ? ' is-long' : ''}` },
      ...inputs.map((input, i) =>
        spec.items
          ? el(
              'label',
              { className: 'param-item' },
              el('span', { textContent: spec.items[i]! }),
              input,
            )
          : input,
      ),
      ...(spec.unit ? [el('span', { className: 'param-unit', textContent: spec.unit })] : []),
    );

    const reset = el('button', {
      type: 'button',
      className: 'param-reset',
      textContent: 'zurücksetzen',
      onclick: () => this.set(key, PARAMS[key].default),
    });

    const row = el(
      'div',
      { className: 'param' },
      el('label', { className: 'param-label', htmlFor: id, textContent: spec.label }),
      fields,
      el(
        'p',
        { className: 'param-help' },
        `${spec.description} `,
        el('span', {
          className: 'param-default',
          textContent: `Standard: ${formatDefault(spec.default)}. `,
        }),
        el('code', { textContent: key }),
        ' ',
        reset,
      ),
    );
    this.rows.set(key, row);
    return row;
  }

  /** Reads one parameter's inputs; ignores the edit while a field is invalid. */
  private schedule(key: ParamKey) {
    const inputs = this.inputs.get(key)!;
    const numbers = inputs.map((i) => (i.value.trim() === '' ? Number.NaN : Number(i.value)));
    const valid = numbers.every(Number.isFinite) && inputs.every((i) => i.checkValidity());
    for (const input of inputs) {
      input.classList.toggle('is-invalid', !valid);
    }
    if (!valid) {
      return;
    }
    const value = typeof PARAMS[key].default === 'number' ? numbers[0]! : numbers;
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.update(resolveParams({ ...diffParams(this.params), [key]: value })),
      APPLY_DELAY_MS,
    );
  }

  private set(key: ParamKey, value: number | ReadonlyArray<number>) {
    this.update(resolveParams({ ...diffParams(this.params), [key]: value }));
  }

  private update(params: ModelParams) {
    this.params = params;
    saveParams(params);
    this.sync();
    this.onChange(params);
  }

  private reset() {
    this.update(DEFAULT_PARAMS);
    this.say('Alle Parameter stehen wieder auf ihrem Standardwert.');
  }

  private async copy() {
    const json = JSON.stringify(diffParams(this.params), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      this.say('Die geänderten Parameter sind in der Zwischenablage.');
    } catch {
      this.say(`Kopieren nicht möglich. Die geänderten Parameter: ${json}`);
    }
  }

  private applyJson(text: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.say('Das ist kein gültiges JSON.');
      return;
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.say('Erwartet wird ein JSON-Objekt, z. B. {"fieldCapacity": 100}.');
      return;
    }
    const params = resolveParams(parsed);
    // Unknown keys, and values resolveParams rejected (wrong type or length).
    const ignored = Object.entries(parsed).filter(
      ([k, v]) => !(k in PARAMS) || JSON.stringify(params[k as ParamKey]) !== JSON.stringify(v),
    );
    this.update(params);
    this.say(
      ignored.length
        ? `Übernommen. Ignoriert (unbekannt oder ungültig): ${ignored.map(([k]) => k).join(', ')}.`
        : 'Übernommen.',
    );
  }

  private say(text: string) {
    this.message.textContent = text;
  }

  /** Shows the current values and marks what differs from the defaults. */
  private sync() {
    const changed = diffParams(this.params);
    for (const key of PARAM_KEYS) {
      const value = this.params[key];
      const values = typeof value === 'number' ? [value] : value;
      this.inputs.get(key)!.forEach((input, i) => {
        if (document.activeElement !== input) {
          input.value = String(values[i]);
        }
        input.classList.remove('is-invalid');
      });
      this.rows.get(key)!.classList.toggle('is-changed', key in changed);
    }
    const n = Object.keys(changed).length;
    this.summaryCount.textContent = n ? `${n} geändert` : '';
    document.documentElement.toggleAttribute('data-custom-params', n > 0);
  }
}
