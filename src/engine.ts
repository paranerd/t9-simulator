import { Dictionary, wordToDigits } from './t9';

export type InputMode = 't9' | 'abc';
export type LetterCase = 'auto' | 'lower' | 'upper';
type Pending =
  | { kind: 'multi'; key: string; index: number; expires: number; letters: string[] }
  | { kind: 't9'; sequence: string; index: number };

export const MULTI_KEYS: Record<string, string> = {
  1: '.,?!\'":;-()', 2: 'abcä2', 3: 'def3', 4: 'ghi4', 5: 'jkl5',
  6: 'mnoö6', 7: 'pqrsß7', 8: 'tuvü8', 9: 'wxyz9', '*': '@/+&€:_=%'
};
export const MULTI_TIMEOUT = 850;

export class TextEngine {
  text = '';
  cursor = 0;
  mode: InputMode = 't9';
  casing: LetterCase = 'auto';
  private pending: Pending | null = null;

  constructor(public dictionary: Dictionary, private onLearn: () => void = () => {}) {}

  get sequence(): string { return this.pending?.kind === 't9' ? this.pending.sequence : ''; }
  get candidates(): string[] { return this.sequence ? this.dictionary.candidates(this.sequence) : []; }
  get candidateIndex(): number { return this.pending?.kind === 't9' ? this.pending.index : 0; }
  get isUnknown(): boolean { return !!this.sequence && this.candidates.length === 0; }
  get expires(): number | null { return this.pending?.kind === 'multi' ? this.pending.expires : null; }

  private applyCase(value: string): string {
    if (this.casing === 'upper') return value.toLocaleUpperCase();
    if (this.casing === 'lower') return value;
    const before = Array.from(this.text).slice(0, this.cursor).join('');
    if (!before.trim() || /[.!?]\s*$/.test(before)) return value.charAt(0).toLocaleUpperCase() + value.slice(1);
    return value;
  }

  get pendingText(): string {
    if (!this.pending) return '';
    if (this.pending.kind === 'multi') return this.applyCase(this.pending.letters[this.pending.index]);
    return this.applyCase(this.candidates[this.pending.index] ?? this.sequence);
  }

  get value(): string {
    const characters = Array.from(this.text);
    return characters.slice(0, this.cursor).join('') + this.pendingText + characters.slice(this.cursor).join('');
  }

  setText(value: string): void {
    this.pending = null;
    this.text = value;
    this.cursor = Array.from(value).length;
  }

  private insert(value: string): void {
    const characters = Array.from(this.text);
    characters.splice(this.cursor, 0, ...Array.from(value));
    this.text = characters.join('');
    this.cursor += Array.from(value).length;
  }

  commit(): boolean {
    if (!this.pending) return true;
    if (this.isUnknown) return false;
    const value = this.pendingText;
    if (this.pending.kind === 't9') {
      this.dictionary.learn(this.candidates[this.pending.index]);
      this.onLearn();
    }
    this.insert(value);
    this.pending = null;
    return true;
  }

  expire(now: number): void {
    if (this.expires !== null && now >= this.expires) this.commit();
  }

  tap(key: string, now = Date.now()): boolean {
    this.expire(now);
    if (key === '#') { this.cycleCase(); return true; }
    if (key === '*' && this.sequence) { this.nextCandidate(); return true; }
    if (key === '0' || key === ' ') {
      if (!this.commit()) return false;
      this.insert(' ');
      return true;
    }
    if (this.mode === 't9' && /^[2-9]$/.test(key)) {
      if (this.pending?.kind === 'multi') this.commit();
      if (this.pending?.kind === 't9') { this.pending.sequence += key; this.pending.index = 0; }
      else this.pending = { kind: 't9', sequence: key, index: 0 };
      return true;
    }
    const letters = MULTI_KEYS[key];
    if (!letters) return true;
    if (this.pending?.kind === 'multi' && this.pending.key === key) {
      this.pending.index = (this.pending.index + 1) % this.pending.letters.length;
      this.pending.expires = now + MULTI_TIMEOUT;
      return true;
    }
    if (!this.commit()) return false;
    this.pending = { kind: 'multi', key, index: 0, expires: now + MULTI_TIMEOUT, letters: Array.from(letters) };
    return true;
  }

  digit(key: string): boolean {
    if (!this.commit()) return false;
    this.insert(key);
    return true;
  }

  newline(): boolean {
    if (!this.commit()) return false;
    this.insert('\n');
    return true;
  }

  backspace(): void {
    if (this.pending?.kind === 't9') {
      this.pending.sequence = this.pending.sequence.slice(0, -1);
      this.pending.index = 0;
      if (!this.pending.sequence) this.pending = null;
    } else if (this.pending) this.pending = null;
    else if (this.cursor > 0) {
      const characters = Array.from(this.text);
      characters.splice(--this.cursor, 1);
      this.text = characters.join('');
    }
  }

  nextCandidate(direction = 1): void {
    if (this.pending?.kind !== 't9' || this.isUnknown) return;
    const count = this.candidates.length;
    this.pending.index = (this.pending.index + direction + count) % count;
  }

  chooseCandidate(index: number): void {
    if (this.pending?.kind === 't9' && index >= 0 && index < this.candidates.length) this.pending.index = index;
  }

  cycleCase(): void {
    this.casing = this.casing === 'auto' ? 'lower' : this.casing === 'lower' ? 'upper' : 'auto';
  }

  setMode(mode: InputMode): boolean {
    if (!this.commit()) {
      // Keep the visible digits of an unknown word when leaving T9.
      this.insert(this.pendingText);
      this.pending = null;
    }
    this.mode = mode;
    return true;
  }

  moveCursor(direction: number): boolean {
    if (!this.commit()) return false;
    this.cursor = Math.max(0, Math.min(Array.from(this.text).length, this.cursor + direction));
    return true;
  }

  addWord(word: string): void {
    if (this.sequence && wordToDigits(word) !== this.sequence) throw new Error(`Das Wort muss zu ${this.sequence} passen.`);
    this.dictionary.add(word);
    this.onLearn();
    if (this.pending?.kind === 't9') {
      this.pending.index = Math.max(0, this.candidates.indexOf(word.toLocaleLowerCase().trim()));
      this.commit();
    }
  }
}
