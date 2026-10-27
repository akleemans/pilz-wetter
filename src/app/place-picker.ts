/**
 * The place picker: one input that is both a dropdown of the listed places
 * (alphabetical) and a free-text search over every Swiss place name. Follows
 * the WAI-ARIA combobox pattern with a listbox popup.
 *
 * Options are built with textContent, never innerHTML: names come from the
 * URL and from the search service.
 */

import { searchPlaces } from './geosearch.ts';
import { filterPlaces, type Place, samePlace } from './places.ts';

const SEARCH_DELAY_MS = 250;
const MAX_SEARCH_RESULTS = 8;

interface Options {
  readonly initial: Place;
  readonly onSelect: (place: Place) => void;
  /** Injected for tests; defaults to the swisstopo search. */
  readonly search?: typeof searchPlaces;
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; results: Array<Place> }
  | { status: 'error' };

export class PlacePicker {
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private readonly toggle: HTMLButtonElement;
  private readonly search: typeof searchPlaces;
  private readonly onSelect: (place: Place) => void;

  private selected: Place;
  /** The options currently rendered, in order, for keyboard navigation. */
  private options: Array<Place> = [];
  private active = -1;
  /** False until the user types: then the whole list is shown. */
  private typed = false;
  private searchState: SearchState = { status: 'idle' };
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private searchAbort: AbortController | undefined;

  constructor(root: HTMLElement, options: Options) {
    this.input = root.querySelector('input')!;
    this.list = root.querySelector('[role="listbox"]')!;
    this.toggle = root.querySelector('button')!;
    this.search = options.search ?? searchPlaces;
    this.onSelect = options.onSelect;
    this.selected = options.initial;
    this.input.value = this.selected.name;

    this.input.addEventListener('focus', () => {
      this.input.select();
      this.open();
    });
    this.input.addEventListener('click', () => this.open());
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.input.addEventListener('blur', () => this.close({ restore: true }));

    this.toggle.addEventListener('mousedown', (e) => e.preventDefault());
    this.toggle.addEventListener('click', () => {
      if (this.isOpen) {
        this.close({ restore: true });
      } else {
        this.typed = false;
        this.input.focus();
        this.open();
      }
    });

    // Keep focus in the input while clicking an option.
    this.list.addEventListener('mousedown', (e) => e.preventDefault());
    this.list.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (li?.dataset.index) {
        this.pick(this.options[Number(li.dataset.index)]!);
      }
    });
  }

  /** Changes the shown place without firing `onSelect`. */
  set(place: Place) {
    this.selected = place;
    this.input.value = place.name;
  }

  private get isOpen() {
    return !this.list.hidden;
  }

  private open() {
    if (!this.isOpen) {
      this.list.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }
    this.render();
  }

  private close({ restore }: { restore: boolean }) {
    clearTimeout(this.searchTimer);
    this.searchAbort?.abort();
    this.searchState = { status: 'idle' };
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.active = -1;
    this.typed = false;
    if (restore) {
      this.input.value = this.selected.name;
    }
  }

  private pick(place: Place) {
    this.selected = place;
    this.input.value = place.name;
    this.close({ restore: false });
    this.onSelect(place);
  }

  private get query() {
    return this.typed ? this.input.value.trim() : '';
  }

  private onInput() {
    this.typed = true;
    this.active = -1;
    clearTimeout(this.searchTimer);
    this.searchAbort?.abort();

    const query = this.query;
    if (query.length < 2) {
      this.searchState = { status: 'idle' };
    } else {
      this.searchState = { status: 'loading' };
      this.searchTimer = setTimeout(() => this.runSearch(query), SEARCH_DELAY_MS);
    }
    this.open();
  }

  private async runSearch(query: string) {
    const abort = new AbortController();
    this.searchAbort = abort;
    try {
      const results = await this.search(query, { signal: abort.signal });
      if (!abort.signal.aborted) {
        this.searchState = { status: 'done', results };
        this.render();
      }
    } catch {
      if (!abort.signal.aborted) {
        this.searchState = { status: 'error' };
        this.render();
      }
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        }
        this.move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.move(-1);
        break;
      case 'Enter': {
        if (!this.isOpen) {
          return;
        }
        e.preventDefault();
        const place = this.options[this.active] ?? this.options[0];
        if (place) {
          this.pick(place);
        }
        break;
      }
      case 'Escape':
        if (this.isOpen) {
          e.preventDefault();
          this.close({ restore: true });
        }
        break;
    }
  }

  private move(delta: number) {
    if (!this.options.length) {
      return;
    }
    const n = this.options.length;
    this.active = this.active < 0 && delta < 0 ? n - 1 : (this.active + delta + n) % n;
    this.updateActive();
  }

  private updateActive() {
    for (const li of this.list.querySelectorAll<HTMLElement>('[role="option"]')) {
      const isActive = Number(li.dataset.index) === this.active;
      li.classList.toggle('is-active', isActive);
      if (isActive) {
        this.input.setAttribute('aria-activedescendant', li.id);
        li.scrollIntoView({ block: 'nearest' });
      }
    }
    if (this.active < 0) {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  private render() {
    const query = this.query;
    const listed = filterPlaces(query);
    const found =
      this.searchState.status === 'done'
        ? this.searchState.results
            .filter((r) => !listed.some((p) => samePlace(p, r)))
            .slice(0, MAX_SEARCH_RESULTS)
        : [];

    this.options = [...listed, ...found];
    const items: Array<HTMLElement> = [];

    if (query && listed.length) {
      items.push(heading('Orte in der Liste'));
    }
    listed.forEach((p, i) => items.push(this.option(p, i)));

    if (query.length >= 2) {
      items.push(heading('Weitere Orte (swisstopo)'));
      if (found.length) {
        found.forEach((p, i) => items.push(this.option(p, listed.length + i)));
      } else {
        items.push(
          status(
            this.searchState.status === 'error'
              ? 'Die Ortssuche ist gerade nicht erreichbar.'
              : this.searchState.status === 'done'
                ? `Kein weiterer Ort für «${query}» gefunden.`
                : 'Suche…',
          ),
        );
      }
    } else if (query) {
      items.push(status('Für die Ortssuche mindestens zwei Buchstaben eingeben.'));
    }

    this.list.replaceChildren(...items);
    if (!query) {
      // Opening the full list: start at the current place.
      const current = this.options.findIndex((p) => samePlace(p, this.selected));
      this.list.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    this.updateActive();
  }

  private option(place: Place, index: number): HTMLElement {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.id = `place-option-${index}`;
    li.dataset.index = String(index);
    li.setAttribute('aria-selected', String(samePlace(place, this.selected)));
    const name = document.createElement('span');
    name.className = 'option-name';
    name.textContent = place.name;
    li.append(name);
    if (place.detail) {
      const detail = document.createElement('span');
      detail.className = 'option-detail';
      detail.textContent = place.detail;
      li.append(detail);
    }
    return li;
  }
}

function heading(text: string): HTMLElement {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'option-heading';
  li.textContent = text;
  return li;
}

function status(text: string): HTMLElement {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'option-status';
  li.textContent = text;
  return li;
}
