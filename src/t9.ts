export type Language = 'de' | 'en';
export type LearnedWords = Record<string, number>;

const keypad: Record<string, string> = {};
for (const [digit, letters] of Object.entries({ 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' })) {
  for (const letter of letters) keypad[letter] = digit;
}

/** Umlauts share a key with their base letter; ß uses the S key. */
export function wordToDigits(word: string): string {
  return Array.from(word.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 's'))
    .map(letter => keypad[letter] ?? '').join('');
}

type Node = { children: Map<string, Node>; exact: string[]; prefixes: string[] };
const node = (): Node => ({ children: new Map(), exact: [], prefixes: [] });

export class Dictionary {
  private root = node();
  private ranks = new Map<string, number>();

  constructor(words: string[], public learned: LearnedWords = {}, public custom: string[] = []) {
    words.forEach((word, rank) => { this.ranks.set(word, rank); this.insert(word); });
    for (const word of custom) this.insert(word);
  }

  private insert(word: string): void {
    let current = this.root;
    for (const digit of wordToDigits(word)) {
      if (!current.children.has(digit)) current.children.set(digit, node());
      current = current.children.get(digit)!;
      if (current.prefixes.length < 32 && !current.prefixes.includes(word)) current.prefixes.push(word);
    }
    if (!current.exact.includes(word)) current.exact.push(word);
  }

  candidates(sequence: string): string[] {
    let current = this.root;
    for (const digit of sequence) {
      const child = current.children.get(digit);
      if (!child) return [];
      current = child;
    }
    // Exact words precede incomplete words. Frequency breaks ties; personal use wins.
    const score = (word: string) => (this.learned[word] ?? 0) * 100000 - (this.ranks.get(word) ?? -1);
    const exact = [...current.exact].sort((a, b) => score(b) - score(a));
    const prefixes = [...current.prefixes].sort((a, b) => score(b) - score(a))
      .map(word => Array.from(word).slice(0, sequence.length).join(''));
    return [...new Set([...exact, ...prefixes])].slice(0, 32);
  }

  add(word: string): void {
    const normalized = word.toLocaleLowerCase().trim();
    if (!/^[a-zäöüß]+$/.test(normalized)) throw new Error('Nur Buchstaben, Umlaute und ß sind erlaubt.');
    if (normalized.length > 24) throw new Error('Ein Wort darf höchstens 24 Buchstaben haben.');
    if (!this.custom.includes(normalized)) this.custom.push(normalized);
    this.insert(normalized);
    this.learn(normalized);
  }

  learn(word: string): void {
    const normalized = word.toLocaleLowerCase();
    if (!/^[a-zäöüß]+$/.test(normalized)) return;
    this.learned[normalized] = Math.min(1000, (this.learned[normalized] ?? 0) + 1);
  }
}
