// Ember Pact — the Ashen Warden's brain. Simple, readable, beatable but not dumb:
// it heals when hurt, guards when you are about to hit hard, and otherwise attacks
// with the biggest damage it can afford. It announces its intent so the player
// can plan around it.

import { describeCard } from './cards.js';

export function pickIntent(state) {
  const foe = state.foe;
  const you = state.you;
  const mana = foe.mana;
  const playable = foe.hand.filter((c) => c.cost <= mana);
  if (playable.length === 0) return { text: 'The Warden rests.', cards: [] };

  // Hurt badly: heal first if it can.
  const heals = playable.filter((c) => c.kind === 'heal' || c.kind === 'siphon');
  if (foe.hp <= 12 && heals.length > 0) {
    const best = heals.sort((a, b) => (b.heal || 0) - (a.heal || 0))[0];
    return { text: `The Warden will play ${best.name}.`, cards: [best] };
  }
  // You are about to finish it: guard up.
  if (foe.hp <= 8) {
    const guards = playable.filter((c) => (c.block || 0) > 0);
    if (guards.length > 0) {
      const best = guards.sort((a, b) => (b.block || 0) - (a.block || 0))[0];
      return { text: `The Warden will play ${best.name}.`, cards: [best] };
    }
  }
  // Otherwise: the hardest hit it can afford, plus a second card if mana allows.
  const attacks = playable.filter((c) => (c.damage || 0) > 0).sort((a, b) => (b.damage || 0) - (a.damage || 0));
  if (attacks.length === 0) {
    const any = playable.sort((a, b) => (b.block || 0) + (b.heal || 0) - ((a.block || 0) + (a.heal || 0)))[0];
    return { text: `The Warden will play ${any.name}.`, cards: [any] };
  }
  const chosen = [attacks[0]];
  let spent = attacks[0].cost;
  for (const c of attacks.slice(1)) {
    if (spent + c.cost <= mana) { chosen.push(c); spent += c.cost; break; }
  }
  const names = chosen.map((c) => c.name).join(' + ');
  return { text: `The Warden will play ${names}.`, cards: chosen };
}

export function intentLine(card) {
  return describeCard(card);
}
