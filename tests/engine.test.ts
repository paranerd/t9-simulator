import { describe, expect, it } from 'vitest';
import { TextEngine } from '../src/engine';
import { Dictionary, wordToDigits } from '../src/t9';
import german from '../src/data/de.json';
import english from '../src/data/en.json';

const setup = () => new TextEngine(new Dictionary(['home', 'good', 'gone', 'hello', 'hallo', 'ich', 'straße', 'für', 'über', 'bär']));
describe('Classic multi-tap input', () => {
  it('cycles letters, commits on a different key and on timeout', () => {
    const engine = setup(); engine.mode = 'abc';
    engine.tap('2', 1000); engine.tap('2', 1100); engine.tap('2', 1200);
    expect(engine.value).toBe('C');
    engine.tap('3', 1300); expect(engine.value).toBe('Cd');
    engine.expire(2200); engine.tap('3', 2300); expect(engine.value).toBe('Cdd');
  });
  it('separates successive letters on the same key after waiting', () => {
    const engine = setup(); engine.mode = 'abc'; engine.tap('2', 1000); engine.tap('2', 1900);
    expect(engine.value).toBe('Aa');
  });
  it('supports umlauts, ß, digits and punctuation', () => {
    const engine = setup(); engine.mode = 'abc'; engine.casing = 'lower';
    for (let i = 0; i < 4; i++) engine.tap('2', 1000 + i * 100);
    expect(engine.value).toBe('ä');
    engine.commit(); for (let i = 0; i < 5; i++) engine.tap('7', 2000 + i * 100);
    engine.digit('9'); engine.tap('1', 3000); engine.commit();
    expect(engine.value).toBe('äß9.');
  });
  it('removes a pending letter before committed text', () => {
    const engine = setup(); engine.mode = 'abc'; engine.setText('Hallo'); engine.tap('2');
    engine.backspace(); expect(engine.value).toBe('Hallo'); engine.backspace(); expect(engine.value).toBe('Hall');
  });
});
describe('T9 and personal learning', () => {
  it('maps German characters to one keypad press each', () => {
    expect(wordToDigits('Straße')).toBe('787273'); expect(wordToDigits('für')).toBe('387');
    expect(wordToDigits('BÄR')).toBe('227'); expect(wordToDigits('über')).toBe('8237');
  });
  it('preserves the selected word when learning changes its rank', () => {
    const engine = setup(); for (const digit of '4663') engine.tap(digit);
    expect(engine.value).toBe('Home'); engine.nextCandidate(); expect(engine.value).toBe('Good');
    engine.tap('0'); expect(engine.value).toBe('Good ');
    for (const digit of '4663') engine.tap(digit);
    expect(engine.value).toBe('Good good');
  });
  it('edits the pending sequence and wraps candidate selection', () => {
    const engine = setup(); for (const digit of '4663') engine.tap(digit);
    engine.nextCandidate(-1); expect(engine.candidateIndex).toBe(engine.candidates.length - 1);
    engine.backspace(); expect(engine.sequence).toBe('466');
  });
  it('requires spelling unknown words and rejects mismatched spelling', () => {
    const engine = setup(); for (const digit of wordToDigits('kevin')) engine.tap(digit);
    expect(engine.isUnknown).toBe(true); expect(engine.commit()).toBe(false);
    expect(() => engine.addWord('bob')).toThrow('passen'); engine.addWord('kevin');
    expect(engine.value).toBe('Kevin'); expect(engine.dictionary.custom).toContain('kevin');
  });
  it('keeps exact words ahead of longer completions', () => {
    const dictionary = new Dictionary(['goodbye', 'home', 'good']);
    expect(dictionary.candidates('4663')[0]).toBe('home');
    dictionary.learn('good'); expect(dictionary.candidates('4663')[0]).toBe('good');
  });
  it('contains representative real vocabulary in both offline dictionaries', () => {
    const de = new Dictionary(german); const en = new Dictionary(english);
    for (const word of ['hallo', 'morgen', 'nachricht', 'straße', 'für', 'über']) expect(de.candidates(wordToDigits(word))).toContain(word);
    for (const word of ['hello', 'tomorrow', 'message', 'friend']) expect(en.candidates(wordToDigits(word))).toContain(word);
  });
});
describe('Cursor and letter case', () => {
  it('inserts and deletes inside a message, including non-BMP characters', () => {
    const engine = setup(); engine.setText('A😀B'); engine.moveCursor(-1); engine.backspace();
    engine.digit('3'); expect(engine.value).toBe('A3B');
    engine.moveCursor(-100); expect(engine.cursor).toBe(0); engine.moveCursor(100); expect(engine.cursor).toBe(3);
  });
  it('capitalizes after sentence-ending punctuation and changes modes safely', () => {
    const engine = setup(); engine.setText('Hallo! '); engine.tap('4'); engine.tap('2'); engine.tap('5'); engine.tap('5'); engine.tap('6');
    expect(engine.value).toBe('Hallo! Hallo'); engine.setMode('abc'); expect(engine.sequence).toBe('');
    engine.cycleCase(); engine.tap('2'); expect(engine.pendingText).toBe('a');
    engine.cycleCase(); expect(engine.pendingText).toBe('A');
  });
});
