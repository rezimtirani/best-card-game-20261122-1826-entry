// Ember Pact — a complete card duel in the browser. You versus the Ashen Warden,
// 30 life each, embers (mana) that grow every turn, a 30-card deck of four
// original suits. First to 0 life loses. Keyboard: 1-5 play a card, Space ends
// the turn. Everything is drawn with DOM + CSS, no images, no network.

import { buildDeck, describeCard, SUITS } from './cards.js';
import { pickIntent } from './ai.js';
import { sfx } from './audio.js';

export const MAX_HP = 30;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshState(seed) {
  const random = seed == null ? Math.random : mulberry32(seed);
  const mk = () => ({
    hp: MAX_HP, maxHp: MAX_HP, block: 0, mana: 3, maxMana: 3,
    deck: buildDeck(random), hand: [], discard: [],
  });
  const you = mk();
  const foe = mk();
  foe.name = 'The Ashen Warden';
  const state = {
    screen: 'title', turn: 1, phase: 'player', over: false, result: null,
    you, foe, log: [], damageDealt: 0, cardsPlayed: 0, foeIntent: null, score: 0,
  };
  drawCards(state, you, 5);
  drawCards(state, foe, 5);
  state.foeIntent = pickIntent(state);
  return state;
}

export function drawCards(state, side, n) {
  for (let i = 0; i < n; i++) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) break;
      side.deck = side.discard;
      side.discard = [];
      for (let j = side.deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [side.deck[j], side.deck[k]] = [side.deck[k], side.deck[j]];
      }
    }
    if (side.hand.length >= 7) { side.discard.push(side.deck.pop()); continue; }
    side.hand.push(side.deck.pop());
  }
}

function dealDamage(state, target, amount, source) {
  let left = amount;
  if (target.block > 0) {
    const absorbed = Math.min(target.block, left);
    target.block -= absorbed;
    left -= absorbed;
    if (absorbed > 0) sfx.block();
  }
  if (left > 0) {
    target.hp = Math.max(0, target.hp - left);
    if (source === 'you') state.damageDealt += left;
    sfx.hit();
  }
  return left;
}

function healSide(side, amount) {
  const before = side.hp;
  side.hp = Math.min(side.maxHp, side.hp + amount);
  if (side.hp > before) sfx.heal();
  return side.hp - before;
}

// Resolve one card played by `side` against `other`. Returns a log line.
export function resolveCard(state, side, other, card) {
  const who = side === state.you ? 'You' : 'The Warden';
  let line = `${who} played ${card.name} — ${describeCard(card)}`;
  if (card.damage) dealDamage(state, other, card.damage, side === state.you ? 'you' : 'foe');
  if (card.block) { side.block += card.block; sfx.block(); }
  if (card.heal) healSide(side, card.heal);
  if (card.draw) drawCards(state, side, card.draw);
  state.cardsPlayed += 1;
  return line;
}

export function playCard(state, index) {
  if (state.screen !== 'table' || state.phase !== 'player' || state.over) return false;
  const card = state.you.hand[index];
  if (!card || card.cost > state.you.mana) return false;
  state.you.mana -= card.cost;
  state.you.hand.splice(index, 1);
  state.you.discard.push(card);
  const line = resolveCard(state, state.you, state.foe, card);
  state.log.unshift(line);
  sfx.play();
  checkEnd(state);
  return true;
}

export function endTurn(state, done) {
  if (state.screen !== 'table' || state.phase !== 'player' || state.over) return;
  state.phase = 'foe';
  state.log.unshift(`— Turn ${state.turn}: your move ends. The Warden acts. —`);
  const intent = state.foeIntent;
  const queue = intent ? intent.cards.slice() : [];
  let step = 0;
  const act = () => {
    if (state.over) { done && done(); return; }
    if (step < queue.length) {
      const card = queue[step++];
      const idx = state.foe.hand.indexOf(card);
      if (idx >= 0 && card.cost <= state.foe.mana) {
        state.foe.mana -= card.cost;
        state.foe.hand.splice(idx, 1);
        state.foe.discard.push(card);
        const line = resolveCard(state, state.foe, state.you, card);
        state.log.unshift(line);
        render();
        checkEnd(state);
        if (!state.over) setTimeout(act, 650);
        else done && done();
      } else { setTimeout(act, 100); }
    } else {
      startPlayerTurn(state);
      done && done();
    }
  };
  setTimeout(act, 450);
}

function startPlayerTurn(state) {
  state.turn += 1;
  state.phase = 'player';
  state.you.maxMana = Math.min(3 + (state.turn - 1), 10);
  state.you.mana = state.you.maxMana;
  state.you.block = 0;
  state.foe.block = 0;
  state.foe.maxMana = Math.min(3 + (state.turn - 1), 10);
  state.foe.mana = state.foe.maxMana;
  drawCards(state, state.you, 2);
  drawCards(state, state.foe, 2);
  state.foeIntent = pickIntent(state);
  state.log.unshift(`— Turn ${state.turn} begins. ${state.you.maxMana} embers, draw 2. —`);
  sfx.turn();
  render();
}

function checkEnd(state) {
  if (state.over) return;
  if (state.foe.hp <= 0 || state.you.hp <= 0) {
    state.over = true;
    state.result = state.foe.hp <= 0 ? 'win' : 'loss';
    state.score = state.damageDealt + (state.result === 'win' ? state.you.hp * 2 : 0) - state.turn * 2;
    state.screen = 'end';
    if (state.result === 'win') sfx.win(); else sfx.lose();
    render();
  }
}

// The logic half above calls render(); it is wired to renderAll in init().
export let render = () => {};
export function setRenderer(fn) { render = fn; }

const $ = (sel) => document.querySelector(sel);
let state = null;
let shotMode = null;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function hpBar(side) {
  const wrap = el('div', 'hpbar');
  const fill = el('div', 'hpfill');
  fill.style.width = `${Math.round((side.hp / side.maxHp) * 100)}%`;
  fill.classList.toggle('low', side.hp <= 10);
  wrap.appendChild(fill);
  wrap.appendChild(el('span', 'hptext', `${side.hp} / ${side.maxHp}`));
  return wrap;
}

function cardNode(card, index, playable, onPlay) {
  const suit = SUITS[card.suit];
  const node = el('div', 'card suit-' + card.suit);
  node.style.background = suit.bg;
  if (!playable) node.classList.add('unplayable');
  const cost = el('div', 'cost', String(card.cost));
  const glyph = el('div', 'glyph', suit.glyph);
  const name = el('div', 'cname', card.name);
  const suitName = el('div', 'suitname', suit.name);
  const text = el('div', 'ctext', describeCard(card));
  node.append(cost, glyph, name, suitName, text);
  node.title = `${card.name} — ${describeCard(card)}`;
  node.addEventListener('click', () => onPlay(index));
  return node;
}

function renderTable() {
  const foe = state.foe;
  const you = state.you;
  $('#foe-name').textContent = foe.name;
  $('#foe-hp').replaceChildren(hpBar(foe));
  $('#foe-block').textContent = foe.block > 0 ? `🛡 ${foe.block} block` : '';
  $('#foe-hand-count').textContent = `${foe.hand.length} cards in hand`;
  $('#foe-intent').textContent = state.foeIntent ? state.foeIntent.text : '';
  const foeHand = $('#foe-hand');
  foeHand.replaceChildren();
  foe.hand.forEach(() => foeHand.appendChild(el('div', 'cardback', '✦')));

  $('#you-hp').replaceChildren(hpBar(you));
  $('#you-block').textContent = you.block > 0 ? `🛡 ${you.block} block` : '';
  const mana = $('#mana');
  mana.replaceChildren();
  for (let i = 0; i < you.maxMana; i++) {
    const gem = el('span', 'gem' + (i < you.mana ? ' lit' : ''));
    gem.textContent = '◆';
    mana.appendChild(gem);
  }
  $('#mana-text').textContent = `${you.mana} / ${you.maxMana} embers`;
  $('#turn-label').textContent = `Turn ${state.turn}`;
  $('#score-label').textContent = `Damage dealt: ${state.damageDealt}`;

  const hand = $('#hand');
  hand.replaceChildren();
  you.hand.forEach((card, i) => {
    hand.appendChild(cardNode(card, i, state.phase === 'player' && card.cost <= you.mana, (idx) => {
      if (playCard(state, idx)) render();
    }));
  });

  const log = $('#log');
  log.replaceChildren();
  state.log.slice(0, 8).forEach((line) => log.appendChild(el('div', 'logline', line)));

  $('#end-turn').disabled = state.phase !== 'player';
  $('#end-turn').textContent = state.phase === 'player' ? 'End Turn (Space)' : 'The Warden is acting…';
}

function renderEnd() {
  const win = state.result === 'win';
  $('#end-title').textContent = win ? 'Victory!' : 'Defeat';
  $('#end-title').className = win ? 'win' : 'loss';
  $('#end-sub').textContent = win
    ? 'The Ashen Warden kneels. The pact is yours.'
    : 'The Ashen Warden stands over the table. The pact is lost.';
  $('#end-stats').replaceChildren(
    el('div', 'stat', `Turns played: ${state.turn}`),
    el('div', 'stat', `Damage dealt: ${state.damageDealt}`),
    el('div', 'stat', `Cards played: ${state.cardsPlayed}`),
    el('div', 'stat', `Your life left: ${state.you.hp} / ${state.you.maxHp}`),
    el('div', 'stat', `Final score: ${state.score}`),
  );
}

function renderAll() {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  if (state.screen === 'title') $('#title-screen').classList.add('active');
  else if (state.screen === 'table') { $('#table-screen').classList.add('active'); renderTable(); }
  else { $('#end-screen').classList.add('active'); renderEnd(); }
}

function startGame(seed) {
  state = freshState(seed);
  state.screen = 'table';
  state.log.unshift('The duel begins. You hold 5 cards and 3 embers.');
  renderAll();
}

// ?shot=table|win|loss|title — deterministic states for the entry screenshots.
function applyShot(shot) {
  shotMode = shot;
  if (shot === 'title') { state = freshState(7); state.screen = 'title'; }
  else if (shot === 'table') {
    state = freshState(7);
    state.screen = 'table';
    state.turn = 4;
    state.you.hp = 22; state.foe.hp = 17;
    state.you.maxMana = 6; state.you.mana = 6;
    state.foe.maxMana = 6; state.foe.mana = 4;
    state.you.block = 4; state.foe.block = 2;
    state.damageDealt = 13; state.cardsPlayed = 9;
    state.log.unshift('The Warden played Tide Wall — Gain 10 block.');
    state.log.unshift('You played Star Bolt — Deal 9 damage.');
    state.log.unshift('You played Ember Slash — Deal 4 damage.');
    state.log.unshift('— Turn 4 begins. 6 embers, draw 2. —');
    state.foeIntent = pickIntent(state);
  } else if (shot === 'win' || shot === 'loss') {
    state = freshState(7);
    state.screen = 'end';
    state.over = true;
    state.result = shot;
    state.turn = 8;
    state.damageDealt = shot === 'win' ? 34 : 21;
    state.cardsPlayed = shot === 'win' ? 17 : 12;
    state.you.hp = shot === 'win' ? 11 : 0;
    state.foe.hp = shot === 'win' ? 0 : 14;
    state.score = state.damageDealt + (shot === 'win' ? state.you.hp * 2 : 0) - state.turn * 2;
    state.log.unshift(shot === 'win' ? 'You played Nova — Deal 15 damage.' : 'The Warden played Wildfire — Deal 12 damage.');
  } else {
    state = freshState();
  }
  renderAll();
}

function init() {
  setRenderer(renderAll);
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  state = freshState();
  $('#start-btn').addEventListener('click', () => { sfx.click(); startGame(); });
  $('#again-btn').addEventListener('click', () => { sfx.click(); startGame(); });
  $('#end-turn').addEventListener('click', () => { sfx.click(); endTurn(state, renderAll); });
  document.addEventListener('keydown', (e) => {
    if (state.screen !== 'table' || state.phase !== 'player' || state.over) return;
    if (e.code === 'Space') { e.preventDefault(); endTurn(state, renderAll); }
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(e.code);
    if (n >= 0 && playCard(state, n)) renderAll();
  });
  if (shot) applyShot(shot);
  renderAll();
  // Test hook: deterministic state access for headless verification.
  window.__game = {
    get state() { return state; },
    start: (seed) => startGame(seed),
    play: (i) => playCard(state, i),
    endTurn: (done) => endTurn(state, done),
    applyShot,
  };
}

document.addEventListener('DOMContentLoaded', init);

