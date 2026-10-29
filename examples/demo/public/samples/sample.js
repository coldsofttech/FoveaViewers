// A small module to try the code viewer on.
import { readFile } from 'node:fs/promises';

const LIMIT = 0x1f4; // 500
const pattern = /^(?<key>\w+)=(?<value>.*)$/;

/**
 * Reads a `key=value` file into an object.
 * @param {string} path
 * @returns {Promise<Record<string, string>>}
 */
export async function readSettings(path) {
  const text = await readFile(path, 'utf8');
  const settings = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = pattern.exec(line);
    if (match?.groups) settings[match.groups.key] = match.groups.value;
  }
  return settings;
}

class Counter {
  #count = 0;

  increment(by = 1) {
    this.#count = Math.min(LIMIT, this.#count + by);
    return this.#count;
  }
}

const counter = new Counter();
console.log(`Counted ${counter.increment(3)} of ${LIMIT}`);
