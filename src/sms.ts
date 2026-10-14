const basic = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const extended = new Set(Array.from('\f^{}\\[~]|€'));

export type SmsInfo = { encoding: 'GSM-7' | 'Unicode'; units: number; parts: number; remaining: number };

export function smsInfo(text: string): SmsInfo {
  const characters = Array.from(text);
  const gsm = characters.every(character => basic.has(character) || extended.has(character));
  const units = gsm ? characters.reduce((sum, c) => sum + (extended.has(c) ? 2 : 1), 0) : text.length;
  const single = gsm ? 160 : 70;
  const multipart = gsm ? 153 : 67;
  if (units <= single) return { encoding: gsm ? 'GSM-7' : 'Unicode', units, parts: 1, remaining: single - units };
  // A two-unit character cannot be split across segments.
  let parts = 1;
  let used = 0;
  for (const character of characters) {
    const width = gsm ? (extended.has(character) ? 2 : 1) : character.length;
    if (used + width > multipart) { parts++; used = 0; }
    used += width;
  }
  return { encoding: gsm ? 'GSM-7' : 'Unicode', units, parts, remaining: multipart - used };
}
