// Callsigns: the public name of an anonymous device, like "Lunar Otter 42".
//
// Every device gets a number per site the first time it posts there (0, 1,
// 2, ... in the callsigns table). A Feistel network keyed by the site id
// shuffles that number into one of ADJECTIVES × NOUNS × 1000 slots. The
// network is a bijection, so two devices on one site never share a callsign,
// and the stored number keeps a device's callsign fixed forever. The key
// makes the same number land on a different name on every site, so a callsign
// neither reveals the join order nor links a device across sites.
//
// Never reorder or edit the word lists or the constants below: that would
// rename every device. Appending words changes the slot count and has the
// same effect.

const ADJECTIVES = [
  "Astral", "Cosmic", "Stellar", "Lunar", "Solar", "Orbital", "Galactic", "Nebular",
  "Quantum", "Radiant", "Ionic", "Celestial", "Polar", "Sidereal", "Interstellar", "Starlit",
  "Moonlit", "Supersonic", "Hypersonic", "Magnetic", "Photonic", "Gravitic", "Infrared", "Ultraviolet",
  "Crimson", "Violet", "Silver", "Golden", "Frozen", "Blazing", "Drifting", "Spinning",
  "Orbiting", "Wandering", "Silent", "Distant", "Swift", "Brave", "Curious", "Dreamy",
  "Sleepy", "Fuzzy", "Jolly", "Mighty", "Tiny", "Giant", "Retro", "Neon",
  "Atomic", "Electric", "Glowing", "Twinkling", "Shimmering", "Luminous", "Dark", "Bright",
  "Ancient", "Rogue", "Binary", "Martian", "Venusian", "Jovian", "Saturnine", "Plutonian",
] as const;

const NOUNS = [
  "Comet", "Quasar", "Pulsar", "Nova", "Nebula", "Meteor", "Asteroid", "Galaxy",
  "Moon", "Planet", "Star", "Magnetar", "Supernova", "Satellite", "Rocket", "Rover",
  "Probe", "Shuttle", "Voyager", "Pioneer", "Explorer", "Pilot", "Captain", "Navigator",
  "Cadet", "Ranger", "Astronaut", "Cosmonaut", "Starship", "Lander", "Station", "Telescope",
  "Orbiter", "Capsule", "Module", "Otter", "Fox", "Panda", "Owl", "Falcon",
  "Whale", "Octopus", "Axolotl", "Lynx", "Raccoon", "Penguin", "Koala", "Tardigrade",
  "Jellyfish", "Hedgehog", "Wombat", "Llama", "Badger", "Squid", "Moth", "Gecko",
  "Narwhal", "Dolphin", "Hamster", "Sloth", "Corgi", "Kitten", "Walrus", "Yeti",
] as const;

const NUMBERS = 1000;

/** Distinct callsigns per site before numbers get a lap suffix ("Lunar Otter 42-2"). */
export const CALLSIGN_SLOTS = ADJECTIVES.length * NOUNS.length * NUMBERS;

// The Feistel network works on 22 bits (two 11-bit halves), the smallest even
// width that holds all slots. Results outside the slots are fed through again
// (cycle walking); that keeps it a bijection on exactly CALLSIGN_SLOTS values.
const HALF_BITS = 11;
const HALF_MASK = (1 << HALF_BITS) - 1;
const ROUNDS = 4;

/** murmur3's 32-bit finalizer: every input bit flips each output bit with ~50% chance. */
function mix(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** One 32-bit key per round, derived from the site id with FNV-1a. */
function roundKeys(siteId: string): number[] {
  let seed = 0x811c9dc5;
  for (let i = 0; i < siteId.length; i++) seed = Math.imul(seed ^ siteId.charCodeAt(i), 0x01000193);
  return Array.from({ length: ROUNDS }, (_, round) => mix(seed + Math.imul(round + 1, 0x9e3779b9)));
}

function feistel(value: number, keys: number[]): number {
  let left = value >>> HALF_BITS;
  let right = value & HALF_MASK;
  for (const key of keys) [left, right] = [right, left ^ (mix(right ^ key) & HALF_MASK)];
  return (left << HALF_BITS) | right;
}

let cachedKeys: { siteId: string; keys: number[] } | undefined;

/** A bijection on [0, CALLSIGN_SLOTS) that looks random and differs per site. */
export function shuffleSlot(slot: number, siteId: string): number {
  if (cachedKeys?.siteId !== siteId) cachedKeys = { siteId, keys: roundKeys(siteId) };
  const keys = cachedKeys.keys;
  let value = slot;
  do value = feistel(value, keys);
  while (value >= CALLSIGN_SLOTS);
  return value;
}

/** The callsign of the device with this number on this site. */
export function callsign(siteId: string, seq: number): string {
  const lap = Math.floor(seq / CALLSIGN_SLOTS);
  let value = shuffleSlot(seq % CALLSIGN_SLOTS, siteId);
  const number = (value % NUMBERS) + 1;
  value = Math.floor(value / NUMBERS);
  const noun = NOUNS[value % NOUNS.length];
  const adjective = ADJECTIVES[Math.floor(value / NOUNS.length)];
  return `${adjective} ${noun} ${number}${lap > 0 ? `-${lap + 1}` : ""}`;
}

/**
 * The device's number on the site. The first post of a device takes the next
 * free number; later posts get the same one back. D1 runs the batch as one
 * transaction, so two first posts cannot take the same number.
 */
export async function callsignNumber(db: D1Database, siteId: string, author: string): Promise<number> {
  const [, row] = await db.batch<{ seq: number }>([
    db
      .prepare(
        `INSERT OR IGNORE INTO callsigns (site_id, author_hash, seq)
         SELECT ?1, ?2, COALESCE(MAX(seq) + 1, 0) FROM callsigns WHERE site_id = ?1`,
      )
      .bind(siteId, author),
    db.prepare("SELECT seq FROM callsigns WHERE site_id = ? AND author_hash = ?").bind(siteId, author),
  ]);
  return row.results[0].seq;
}
