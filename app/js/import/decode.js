// Turns file bytes into text. Older Norwegian text files are often
// Windows-1252 / ISO-8859-1, and some UTF-8 text has been decoded twice
// («Ã¸» instead of «ø»); both are handled here.

function hasUtf16Pattern(bytes) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 2000));
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      if (i % 2 === 0) evenZeros++;
      else oddZeros++;
    }
  }
  const half = sample.length / 2;
  if (oddZeros > half * 0.3 && evenZeros < half * 0.05) return 'utf-16le';
  if (evenZeros > half * 0.3 && oddZeros < half * 0.05) return 'utf-16be';
  return null;
}

export function decodeBytes(bytes) {
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return repairMojibake(new TextDecoder('utf-8').decode(bytes.subarray(3)));
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  const utf16 = hasUtf16Pattern(bytes);
  if (utf16) return new TextDecoder(utf16).decode(bytes);
  try {
    return repairMojibake(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    // Windows-1252 is a superset of ISO-8859-1 for printable characters.
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

let cp1252Bytes = null;

// Reverse table: character -> Windows-1252 byte.
function windows1252Table() {
  if (!cp1252Bytes) {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    const chars = new TextDecoder('windows-1252').decode(all);
    cp1252Bytes = new Map(Array.from(chars, (ch, i) => [ch, i]));
  }
  return cp1252Bytes;
}

const MOJIBAKE = /Ã[\u0080-¿]|Ã[¦¸¥†˜…©]|â€[™œ\u009D”“¦]/g;
const NORWEGIAN_LETTERS = /[æøåÆØÅ]/g;

// Reverses UTF-8 text that was decoded as Windows-1252 somewhere along the way.
export function repairMojibake(text) {
  const broken = (text.match(MOJIBAKE) || []).length;
  if (broken < 3 || broken < (text.match(NORWEGIAN_LETTERS) || []).length) return text;
  const table = windows1252Table();
  const bytes = new Uint8Array(text.length);
  let length = 0;
  for (const ch of text) {
    const byte = table.get(ch);
    if (byte === undefined) return text;
    bytes[length++] = byte;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } catch {
    return text;
  }
}
