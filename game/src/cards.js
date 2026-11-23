// Ember Pact — card definitions. Four original suits, no borrowed names or art.
// Suits: Ember (fire), Tide (water), Thorn (nature), Star (arcane).
// Every card: id, name, suit, cost (embers), kind, and numbers. Text is derived
// from kind + numbers so the UI and the AI share one source of truth.

export const SUITS = {
  ember: { name: 'Ember', glyph: '◆', color: '#ff7a2f', dark: '#a33d00', bg: 'linear-gradient(160deg,#5a1e00,#c2410c 55%,#f97316)' },
  tide: { name: 'Tide', glyph: '≈', color: '#38bdf8', dark: '#075985', bg: 'linear-gradient(160deg,#082f49,#0369a1 55%,#38bdf8)' },
  thorn: { name: 'Thorn', glyph: '✿', color: '#4ade80', dark: '#14532d', bg: 'linear-gradient(160deg,#052e16,#15803d 55%,#4ade80)' },
  star: { name: 'Star', glyph: '✦', color: '#c084fc', dark: '#581c87', bg: 'linear-gradient(160deg,#2e1065,#7e22ce 55%,#c084fc)' },
};

// kind: 'attack' | 'guard' | 'heal' | 'siphon' | 'draw-attack'
export const CARD_DEFS = [
  { id: 'ember-slash', name: 'Ember Slash', suit: 'ember', cost: 1, kind: 'attack', damage: 4 },
  { id: 'tide-cut', name: 'Tide Cut', suit: 'tide', cost: 2, kind: 'attack', damage: 6 },
  { id: 'thorn-whip', name: 'Thorn Whip', suit: 'thorn', cost: 1, kind: 'attack', damage: 3, block: 1 },
  { id: 'star-bolt', name: 'Star Bolt', suit: 'star', cost: 3, kind: 'attack', damage: 9 },
  { id: 'ember-guard', name: 'Ember Guard', suit: 'ember', cost: 1, kind: 'guard', block: 6 },
  { id: 'tide-wall', name: 'Tide Wall', suit: 'tide', cost: 2, kind: 'guard', block: 10 },
  { id: 'thorn-mend', name: 'Thorn Mend', suit: 'thorn', cost: 2, kind: 'heal', heal: 7 },
  { id: 'star-siphon', name: 'Star Siphon', suit: 'star', cost: 3, kind: 'siphon', damage: 5, heal: 5 },
  { id: 'wildfire', name: 'Wildfire', suit: 'ember', cost: 4, kind: 'attack', damage: 12 },
  { id: 'deep-current', name: 'Deep Current', suit: 'tide', cost: 2, kind: 'draw-attack', damage: 4, draw: 1 },
  { id: 'bramble-snare', name: 'Bramble Snare', suit: 'thorn', cost: 2, kind: 'attack', damage: 3, block: 4 },
  { id: 'nova', name: 'Nova', suit: 'star', cost: 5, kind: 'attack', damage: 15 },
];

export function describeCard(card) {
  switch (card.kind) {
    case 'attack': return `Deal ${card.damage} damage.` + (card.block ? ` Gain ${card.block} block.` : '');
    case 'guard': return `Gain ${card.block} block.`;
    case 'heal': return `Restore ${card.heal} life.`;
    case 'siphon': return `Deal ${card.damage} damage. Restore ${card.heal} life.`;
    case 'draw-attack': return `Deal ${card.damage} damage. Draw ${card.draw} card.`;
    default: return '';
  }
}

// A 30-card deck: 3 copies of the cheap cards, 2 of the mid ones, 1 of Nova.
export function buildDeck(random = Math.random) {
  const counts = {
    'ember-slash': 3, 'tide-cut': 3, 'thorn-whip': 3, 'star-bolt': 2,
    'ember-guard': 3, 'tide-wall': 2, 'thorn-mend': 3, 'star-siphon': 2,
    'wildfire': 2, 'deep-current': 3, 'bramble-snare': 3, 'nova': 1,
  };
  const deck = [];
  for (const def of CARD_DEFS) {
    for (let i = 0; i < (counts[def.id] || 0); i++) deck.push({ ...def, uid: `${def.id}-${i}` });
  }
  // Fisher-Yates shuffle.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
