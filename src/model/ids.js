// Identifiers in the DEDALO style (`stg_k8lccw677u`): a prefix and ten base-36 characters.
// VULCANO keeps DEDALO's identifiers untouched and mints its own for what it adds.

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newId(prefix) {
  let s = '';
  const rnd = globalThis.crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(10)) : null;
  for (let i = 0; i < 10; i++) {
    const n = rnd ? rnd[i] % ALPHABET.length : Math.floor(Math.random() * ALPHABET.length);
    s += ALPHABET[n];
  }
  return `${prefix}_${s}`;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString();
