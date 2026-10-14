import { describe, expect, it } from 'vitest';
import { smsInfo } from '../src/sms';
describe('SMS segmentation', () => {
  it('uses one GSM segment for 160 basic characters and 153 in multipart messages', () => {
    expect(smsInfo('a'.repeat(160))).toEqual({ encoding: 'GSM-7', units: 160, parts: 1, remaining: 0 });
    expect(smsInfo('a'.repeat(161))).toEqual({ encoding: 'GSM-7', units: 161, parts: 2, remaining: 145 });
    expect(smsInfo('äöüß')).toMatchObject({ encoding: 'GSM-7', units: 4 });
  });
  it('counts extended alphabet characters as two units', () => {
    expect(smsInfo('€{}^')).toMatchObject({ encoding: 'GSM-7', units: 8, remaining: 152 });
  });
  it('uses UTF-16 units for Unicode SMS, including emojis', () => {
    expect(smsInfo('😀'.repeat(35))).toMatchObject({ encoding: 'Unicode', units: 70, parts: 1, remaining: 0 });
    expect(smsInfo('😀'.repeat(36))).toMatchObject({ encoding: 'Unicode', units: 72, parts: 2, remaining: 61 });
  });
  it('never splits escape sequences between segments', () => {
    expect(smsInfo('a'.repeat(152) + '€' + 'a'.repeat(151))).toMatchObject({ units: 305, parts: 2, remaining: 0 });
    expect(smsInfo('a'.repeat(152) + '€' + 'a'.repeat(152))).toMatchObject({ units: 306, parts: 3, remaining: 152 });
  });
});
