'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type ScryfallCard = {
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  produced_mana?: string[];
  cmc?: number;
  rarity?: string;
  set?: string;
  set_name?: string;
  image_uris?: {
    normal?: string;
    large?: string;
    small?: string;
    art_crop?: string;
    border_crop?: string;
    png?: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    flavor_text?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
    image_uris?: {
      normal?: string;
      large?: string;
      small?: string;
      art_crop?: string;
      border_crop?: string;
      png?: string;
    };
  }>;
};

type Suggestion = {
  id: string;
  name: string;
  image?: string | null;
  type_line?: string;
  mana_cost?: string;
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function normalizeName(n: string) {
  return n.toLowerCase().trim();
}

function getBestCardImage(card: ScryfallCard | null): string | null {
  if (!card) return null;
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

function getOracleText(card: ScryfallCard | null): string {
  if (!card) return '';
  if (card.oracle_text) return card.oracle_text;
  if (card.card_faces?.length) {
    return card.card_faces
      .map((f) => `${f.name}${f.oracle_text ? `\n${f.oracle_text}` : ''}`)
      .join('\n\n—\n\n');
  }
  return '';
}

function getTypeLine(card: ScryfallCard | null): string {
  if (!card) return '';
  if (card.type_line) return card.type_line;
  if (card.card_faces?.length) {
    return card.card_faces.map((f) => f.type_line).filter(Boolean).join(' // ');
  }
  return '';
}

function getManaCost(card: ScryfallCard | null): string {
  if (!card) return '';
  if (card.mana_cost) return card.mana_cost;
  if (card.card_faces?.length) {
    return card.card_faces.map((f) => f.mana_cost).filter(Boolean).join(' // ');
  }
  return '';
}

function buildContextTags(card: ScryfallCard | null): string[] {
  if (!card) return [];
  const t = getTypeLine(card).toLowerCase();
  const o = getOracleText(card).toLowerCase();

  const tags: string[] = [];

  if (t.includes('legendary') && t.includes('creature')) tags.push('legendary-creature');
  if (t.includes('planeswalker')) tags.push('planeswalker');
  if (t.includes('artifact')) tags.push('artifact');
  if (t.includes('enchantment')) tags.push('enchantment');
  if (t.includes('instant')) tags.push('instant');
  if (t.includes('sorcery')) tags.push('sorcery');
  if (t.includes('land')) tags.push('land');
  if (t.includes('equipment')) tags.push('equipment');
  if (t.includes('aura')) tags.push('aura');

  if (o.includes('draw a card') || o.includes('draw two') || o.includes('draw three') || o.includes('draw')) tags.push('card-draw');
  if (o.includes('treasure')) tags.push('treasure');
  if (o.includes('create') && (o.includes('token') || o.includes('tokens'))) tags.push('tokens');
  if (o.includes('counter target') || o.includes('counterspell')) tags.push('countermagic');
  if (o.includes('destroy') || o.includes('exile')) tags.push('removal');
  if (o.includes('each opponent')) tags.push('each-opponent');
  if (o.includes('whenever you cast') || o.includes('whenever you play') || o.includes('magecraft')) tags.push('cast-triggers');
  if (o.includes('enters the battlefield') || o.includes('when') && o.includes('enters')) tags.push('etb');
  if (o.includes('sacrifice')) tags.push('sacrifice');
  if (o.includes('graveyard')) tags.push('graveyard');
  if (o.includes('search your library')) tags.push('tutor-or-search');
  if (o.includes('add {') || o.includes('adds {') || o.includes('add one mana') || o.includes('add two mana')) tags.push('mana');
  if (o.includes('gain life') || o.includes('lifelink')) tags.push('lifegain');
  if (o.includes('+1/+1 counter') || o.includes('proliferate')) tags.push('counters');

  return Array.from(new Set(tags));
}

/**
 * =========================
 * Keyword tooltips (FREE)
 * =========================
 */
const KEYWORD_DEFINITIONS: Record<string, string> = {
  'first strike': 'First strike: This creature deals combat damage before creatures without first strike.',
  'double strike': 'Double strike: This creature deals combat damage twice (first strike damage and regular damage).',
  trample:
    'Trample: If this creature would deal extra combat damage beyond what is needed to kill blockers, it can assign the rest to the player or planeswalker it is attacking.',
  menace: 'Menace: This creature cannot be blocked except by two or more creatures.',
  flying: 'Flying: This creature can only be blocked by creatures with flying or reach.',
  reach: 'Reach: This creature can block creatures with flying.',
  vigilance: 'Vigilance: Attacking does not cause this creature to tap.',
  haste: 'Haste: This creature can attack and use {T} abilities the turn it enters the battlefield.',
  deathtouch: 'Deathtouch: Any amount of damage this creature deals to another creature is lethal.',
  lifelink: 'Lifelink: Damage dealt by this creature also causes you to gain that much life.',
  ward:
    'Ward: When this becomes the target of a spell or ability an opponent controls, counter it unless that opponent pays the ward cost (if any).',
  hexproof: 'Hexproof: This permanent cannot be the target of spells or abilities your opponents control.',
  shroud: 'Shroud: This permanent cannot be the target of spells or abilities (including yours).',
  indestructible: 'Indestructible: This permanent cannot be destroyed by damage or “destroy” effects.',
  protection:
    'Protection: Prevents certain damage, targeting, blocking, and enchanting/equipping based on the stated quality (e.g., “protection from red”).',
  flash: 'Flash: You may cast this spell any time you could cast an instant.',
  convoke:
    'Convoke: Your creatures can help pay for this spell. Each creature you tap pays for {1} or one mana of that creature’s color.',
  delve: 'Delve: You may exile cards from your graveyard to help pay for this spell. Each card exiled pays for {1}.',
  kicker: 'Kicker: You may pay an extra cost when casting. If you do, you get the “kicked” bonus effect.',
  cascade:
    'Cascade: When you cast this spell, exile cards from the top until you exile a nonland card with lower mana value. You may cast it for free.',
  cycling: 'Cycling: You may pay a cost and discard this card to draw a card.',
  equip: 'Equip: Pay the equip cost to attach the Equipment to a creature you control (normally only as a sorcery).',
  enchant: 'Enchant: This Aura targets something as you cast it and attaches to that kind of object when it resolves.',
  sacrifice:
    'Sacrifice: Move a permanent you control to its owner’s graveyard. This is not “destroy,” and it does not target unless it says target.',
  exile:
    'Exile: Move a card to the exile zone. It is not in the graveyard, and many recursion effects cannot get it back.',
  mill: 'Mill: Put cards from the top of a library into a graveyard.',
  scry:
    'Scry: Look at that many cards from the top of your library, then put any number on the bottom and the rest on top.',
  surveil:
    'Surveil: Look at that many cards from the top of your library, then put any number into your graveyard and the rest back on top.',
  counter: 'Counter: Remove a spell from the stack so it does not resolve (usually goes to the graveyard).',
  token: 'Token: A game object that represents a permanent but is not a card.',
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Option A: only ONE tooltip open at a time (openKey), and it opens where the clicked word is.
 */
function renderTextWithTooltips(
  text: string,
  openKey: string | null,
  setOpenKey: (k: string | null) => void
): React.ReactNode {
  if (!text) return null;

  const keys = Object.keys(KEYWORD_DEFINITIONS).sort((a, b) => b.length - a.length);
  const pattern = keys.map((k) => escapeRegex(k)).join('|');
  const re = new RegExp(`(${pattern})`, 'gi');

  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const parts = line.split(re);

    const renderedLine = parts.map((part, idx) => {
      const keyMatch = keys.find((k) => k.toLowerCase() === part.toLowerCase());
      if (!keyMatch) return <React.Fragment key={`${lineIdx}-${idx}`}>{part}</React.Fragment>;

      const isOpen = openKey === keyMatch;
      const definition = KEYWORD_DEFINITIONS[keyMatch];

      return (
        <span key={`${lineIdx}-${idx}`} className="relative inline-flex items-baseline">
          <button
            type="button"
            className={cx(
              'mx-0.5 rounded px-1 py-0.5 text-left font-semibold',
              'underline decoration-zinc-600 underline-offset-2',
              'hover:bg-zinc-800/60 focus:outline-none focus:ring-2 focus:ring-zinc-500',
              'text-zinc-100'
            )}
            aria-expanded={isOpen}
            aria-label={`${keyMatch} definition`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenKey(isOpen ? null : keyMatch);
            }}
            onFocus={() => setOpenKey(keyMatch)}
          >
            {part}
          </button>

          {isOpen ? (
            <span
              className={cx(
                'absolute left-0 top-full z-50 mt-2 w-[min(360px,85vw)]',
                'rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow-xl'
              )}
              role="tooltip"
            >
              <span className="block text-zinc-100">{definition}</span>
              <span className="mt-1 block text-[11px] text-zinc-400">Tip: click anywhere to close. Esc also closes.</span>
            </span>
          ) : null}
        </span>
      );
    });

    return (
      <React.Fragment key={`line-${lineIdx}`}>
        {renderedLine}
        {lineIdx < lines.length - 1 ? '\n' : null}
      </React.Fragment>
    );
  });
}

/**
 * =========================
 * Glossary (Acronyms + shorthand + abilities)
 * =========================
 */
type GlossaryItem = {
  term: string;
  meaning: string;
  details?: string;
  tags?: string[];
};

const BASE_GLOSSARY: GlossaryItem[] = [
  { term: 'ETB', meaning: 'Enters the Battlefield', details: 'Triggered abilities that happen when a permanent enters the battlefield.', tags: ['trigger', 'battlefield'] },
  { term: 'LTB', meaning: 'Leaves the Battlefield', details: 'Triggered abilities that happen when a permanent leaves the battlefield (dies, exiled, bounced, etc.).', tags: ['trigger', 'battlefield'] },
  { term: 'Dies', meaning: 'Goes from battlefield to graveyard', details: '“Dies” specifically means it went to a graveyard from the battlefield.', tags: ['rules'] },
  { term: 'CMC', meaning: 'Converted Mana Cost (older term)', details: 'Modern rules usually say “Mana Value (MV)”. They mean the same thing.', tags: ['mana'] },
  { term: 'MV', meaning: 'Mana Value', details: 'A number representing the total mana cost (ignores color). Example: {2}{U} has MV 3.', tags: ['mana'] },
  { term: '{T}', meaning: 'Tap symbol', details: 'If an ability has {T} in the cost, you tap the permanent to activate it.', tags: ['symbols'] },
  { term: '{C}', meaning: 'Colorless mana', details: 'This is colorless mana. It is not the same as “any color”.', tags: ['symbols', 'mana'] },
  { term: 'P/T', meaning: 'Power / Toughness', details: 'Power is damage dealt; toughness is how much damage it can take before dying.', tags: ['combat'] },
  { term: '+1/+1', meaning: 'Stat bonus', details: 'Adds +1 power and +1 toughness (often via counters or effects).', tags: ['combat'] },
  { term: 'Counterspell', meaning: 'Stops a spell', details: 'A countered spell is removed from the stack and does not resolve.', tags: ['interaction'] },
  { term: 'Removal', meaning: 'Answer card', details: 'Cards that destroy, exile, bounce, or otherwise deal with threats.', tags: ['interaction'] },
  { term: 'Bounce', meaning: 'Return to hand', details: 'Returning a permanent to hand resets it and can remove attachments/counters in many cases.', tags: ['interaction'] },
  { term: 'Board wipe', meaning: 'Mass removal', details: 'A spell that clears many permanents (often all creatures). Example: Wrath of God.', tags: ['interaction'] },
  { term: 'Ramp', meaning: 'Mana acceleration', details: 'Ways to get more mana earlier (mana rocks, extra lands, cost reducers).', tags: ['mana'] },
  { term: 'Mana rock', meaning: 'Artifact that makes mana', details: 'Example: Sol Ring, Arcane Signet.', tags: ['mana', 'artifact'] },
  { term: 'Mana dork', meaning: 'Creature that makes mana', details: 'Small creatures that tap for mana. Example: Llanowar Elves.', tags: ['mana', 'creature'] },
  { term: 'Tutor', meaning: 'Search your library', details: 'A card that finds a specific card (or type of card) from your library.', tags: ['consistency'] },
  { term: 'Card advantage', meaning: 'More cards than opponents', details: 'Drawing extra cards or trading 1 card for 2+ of theirs.', tags: ['value'] },
  { term: 'Value engine', meaning: 'Repeated advantage', details: 'A permanent or combo that generates cards/mana/tokens repeatedly over time.', tags: ['value'] },
  { term: 'Synergy', meaning: 'Cards that work well together', details: 'Two cards that combine for a stronger outcome than either alone.', tags: ['deckbuilding'] },
  { term: 'Wincon', meaning: 'Win condition', details: 'The primary way your deck plans to win (combo, combat, burn, etc.).', tags: ['deckbuilding'] },
  { term: 'Combo', meaning: 'Cards that create a powerful loop', details: 'Sometimes infinite, sometimes just a big swing. Often requires multiple pieces.', tags: ['deckbuilding'] },
  { term: 'Stax', meaning: 'Resource denial / taxing', details: 'Cards that limit actions (tax spells, restrict untaps, etc.). Not always popular at casual tables.', tags: ['strategy'] },
  { term: 'Aristocrats', meaning: 'Sacrifice-for-value strategy', details: 'Uses sacrifice outlets + death triggers to drain life or gain value.', tags: ['strategy'] },
  { term: 'Go wide', meaning: 'Many creatures', details: 'Win by building lots of small creatures/tokens and buffing them.', tags: ['strategy'] },
  { term: 'Go tall', meaning: 'One huge threat', details: 'Win by building one creature very large (auras, counters, equipment).', tags: ['strategy'] },
  { term: 'Politics', meaning: 'Multiplayer negotiation', details: 'Commander often involves deals, threats, and targeting decisions.', tags: ['commander'] },
  { term: 'Commander tax', meaning: 'Extra cost to recast commander', details: 'Each time you cast your commander from the command zone, it costs {2} more for each previous time.', tags: ['commander'] },
  { term: 'Stack', meaning: 'Where spells/abilities wait to resolve', details: 'Players can respond while things are on the stack (instants/abilities).', tags: ['rules'] },
  { term: 'Priority', meaning: 'Who can act right now', details: 'Only a player with priority can cast a spell or activate most abilities.', tags: ['rules'] },
];

const ABILITY_GLOSSARY: GlossaryItem[] = Object.entries(KEYWORD_DEFINITIONS).map(([term, meaning]) => ({
  term,
  meaning: meaning.split(':')[0].trim(),
  details: meaning,
  tags: ['ability'],
}));

const GLOSSARY: GlossaryItem[] = [...BASE_GLOSSARY, ...ABILITY_GLOSSARY].sort((a, b) =>
  a.term.toLowerCase().localeCompare(b.term.toLowerCase())
);

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * =========================
 * FREE, deterministic "Standard explanation"
 * + now includes Example play + Role/Speed badges
 * =========================
 */

type RoleBadge = {
  role: 'Ramp' | 'Removal' | 'Draw' | 'Threat' | 'Engine' | 'Protection' | 'Tutor' | 'Utility' | 'Disruption';
  speed: 'Early' | 'Mid' | 'Late';
};

function inferRoleAndSpeed(card: ScryfallCard): RoleBadge {
  const tags = buildContextTags(card);
  const tl = getTypeLine(card).toLowerCase();
  const o = getOracleText(card).toLowerCase();
  const mv = card.cmc ?? 0;

  let role: RoleBadge['role'] = 'Utility';

  if (tags.includes('mana') || tags.includes('treasure')) role = 'Ramp';
  else if (tags.includes('removal')) role = 'Removal';
  else if (tags.includes('card-draw')) role = 'Draw';
  else if (tags.includes('tutor-or-search')) role = 'Tutor';
  else if (o.includes('hexproof') || o.includes('indestructible') || o.includes('ward') || o.includes('protection')) role = 'Protection';
  else if (tags.includes('countermagic')) role = 'Disruption';
  else if (tl.includes('creature') && (card.power || card.toughness)) role = 'Threat';
  else if (o.includes('whenever') || o.includes('at the beginning of') || o.includes('each upkeep') || o.includes('draw') || o.includes('create')) role = 'Engine';

  let speed: RoleBadge['speed'] = 'Mid';
  if (mv <= 2) speed = 'Early';
  else if (mv >= 6) speed = 'Late';

  // A few overrides for “feel”
  if (role === 'Ramp' && mv <= 2) speed = 'Early';
  if (role === 'Removal' && mv <= 2) speed = 'Early';
  if (role === 'Engine' && mv >= 5) speed = 'Late';

  return { role, speed };
}

function buildExamplePlay(card: ScryfallCard): string[] {
  const tags = buildContextTags(card);
  const tl = getTypeLine(card).toLowerCase();
  const o = getOracleText(card).toLowerCase();
  const mv = card.cmc ?? 0;

  const lines: string[] = [];

  if (tags.includes('mana')) {
    lines.push('• Example play: Cast this early, then use the extra mana immediately to get ahead on tempo.');
  }
  if (tags.includes('removal')) {
    lines.push('• Example play: Hold this until a threat is about to win the game or enable a combo, then answer it.');
  }
  if (tags.includes('card-draw')) {
    lines.push('• Example play: Use this when you have spare mana and can safely spend a turn refilling your hand.');
  }
  if (tags.includes('countermagic')) {
    lines.push('• Example play: Leave mana open when opponents are likely to cast a board wipe or game-ending spell.');
  }
  if (tags.includes('tokens')) {
    lines.push('• Example play: Make tokens first, then turn them into damage (anthems) or value (sacrifice outlets).');
  }
  if (tags.includes('graveyard')) {
    lines.push('• Example play: Set up your graveyard first (self-mill, discarding, sacrificing), then convert it into value.');
  }
  if (tags.includes('etb')) {
    lines.push('• Example play: If this has an ETB effect, consider blink/bounce lines to reuse it for more value.');
  }
  if (tags.includes('counters')) {
    lines.push('• Example play: If this uses counters, pair with +1/+1 counter support or proliferate to scale faster.');
  }
  if (tl.includes('equipment')) {
    lines.push('• Example play: Play the Equipment early, then equip when you’re ready to attack or protect a key creature.');
  }
  if (tl.includes('aura')) {
    lines.push('• Example play: Try to cast Auras when opponents are tapped out, so you don’t get blown out by removal.');
  }

  if (lines.length === 0) {
    if (mv <= 2) lines.push('• Example play: This is cheap—try to develop it early to improve your curve.');
    else if (mv >= 6) lines.push('• Example play: Plan a turn ahead (ramp or protection) so this resolves and matters immediately.');
    else lines.push('• Example play: Look for the best timing window where this creates advantage right away.');
  }

  // Keep it short + readable
  return lines.slice(0, 3);
}

function buildStandardExplanation(card: ScryfallCard): string {
  const typeLine = getTypeLine(card);
  const oracle = getOracleText(card);
  const tags = buildContextTags(card);
  const manaCost = getManaCost(card);
  const cmc = card.cmc ?? null;

  const tl = typeLine.toLowerCase();
  const o = oracle.toLowerCase();

  const what: string[] = [];
  const why: string[] = [];
  const patterns: string[] = [];
  const gotchas: string[] = [];
  const tips: string[] = [];

  if (tags.includes('mana') || (tl.includes('artifact') && o.includes('{t}: add'))) what.push('• Helps you produce mana, so you can cast spells sooner.');
  if (tags.includes('card-draw')) what.push('• Helps you draw extra cards (more options each turn).');
  if (tags.includes('removal')) what.push('• Removal: it answers a threat (often by destroying or exiling).');
  if (tags.includes('tokens')) what.push('• Creates tokens (bodies on board) which can attack, block, or fuel other effects.');
  if (tags.includes('countermagic')) what.push('• Can stop an opponent’s spell by countering it (it does not resolve).');
  if (tags.includes('graveyard')) what.push('• Interacts with the graveyard (yours or opponents’).');
  if (tags.includes('tutor-or-search')) what.push('• Lets you search your library (increases consistency).');
  if (tags.includes('counters')) what.push('• Uses counters (often scales over time with support like proliferate).');

  if (tl.includes('creature') && (card.power || card.toughness)) what.push(`• It is a creature (${card.power ?? '?'} / ${card.toughness ?? '?'}). It can attack and block.`);
  if (tl.includes('planeswalker')) what.push('• It is a planeswalker. You activate one loyalty ability per turn (on your turn).');

  if (what.length === 0) what.push(oracle.trim() ? '• This card’s main effect is described in its oracle text below.' : '• This card does not have oracle text (or it was not available from Scryfall).');

  if (tags.includes('mana')) {
    why.push('• Mana acceleration is strong in Commander because games often revolve around big turns.');
    patterns.push('• Play it early if possible, then use the extra mana immediately.');
    tips.push('• Early ramp is usually more valuable than late ramp.');
  }
  if (tags.includes('card-draw')) {
    why.push('• Card draw prevents you from running out of options (cards in hand).');
    patterns.push('• Use it when you have mana available and can safely spend a turn drawing.');
    tips.push('• Drawing cards is especially strong if your deck plays many cheap spells.');
  }
  if (tags.includes('removal')) {
    why.push('• Commander is threat-dense; efficient removal keeps you from losing to one problem card.');
    patterns.push('• Hold removal for the most dangerous threat, not the first creature you see.');
    gotchas.push('• Check what it can target (creature only vs any permanent, etc.).');
    tips.push('• Save removal for cards that will beat you soon or enable a combo.');
  }
  if (tags.includes('countermagic')) {
    why.push('• Counterspells can stop board wipes, combos, or game-ending spells.');
    patterns.push('• Keep mana open when you expect an important spell from an opponent.');
    tips.push('• Don’t counter small spells unless they directly threaten you.');
  }
  if (tags.includes('tokens')) {
    why.push('• Tokens scale well with anthem effects, sacrifice outlets, and “go wide” strategies.');
    patterns.push('• Make tokens, then use them to attack, block, or convert them into value.');
    tips.push('• Token decks usually want ways to buff tokens or convert them into cards/mana.');
  }
  if (tags.includes('graveyard')) {
    why.push('• Graveyard interaction enables recursion, sacrifice loops, and value engines.');
    patterns.push('• Use it when you can immediately get value from the graveyard.');
    gotchas.push('• Graveyard hate (like exile effects) can stop these plans.');
  }
  if (tags.includes('tutor-or-search')) {
    why.push('• Searching makes your deck more consistent (finds the right card for the situation).');
    patterns.push('• Decide what you need next turn (answer vs win condition) before you search.');
    tips.push('• Try to tutor with a plan: “What am I doing for the next 2 turns?”');
  }
  if (tags.includes('counters')) {
    why.push('• Counter-based cards scale well with support like proliferate or counter doublers.');
    patterns.push('• Add counters over time, then convert them into damage/value.');
    tips.push('• If your deck supports counters, this often snowballs quickly.');
  }

  if (o.includes('target')) gotchas.push('• This card targets. If the target becomes illegal, the effect may fail.');
  if (o.includes('exile')) gotchas.push('• Exile is different from destroy: it usually prevents most recursion.');
  if (o.includes('until end of turn')) gotchas.push('• “Until end of turn” effects wear off during cleanup at the end of the turn.');
  if (tl.includes('equipment')) {
    gotchas.push('• Equipment must be attached by paying its equip cost (normally only as a sorcery).');
    tips.push('• Equip is not the same as casting the Equipment.');
  }
  if (tl.includes('aura')) {
    gotchas.push('• Auras target when cast. If the target is illegal, the Aura does not resolve.');
    tips.push('• Be careful enchanting creatures that might be removed in response.');
  }
  if (tl.includes('planeswalker')) {
    gotchas.push('• You can activate one loyalty ability per planeswalker per turn, only on your turn.');
    tips.push('• Protect planeswalkers with blockers or removal.');
  }

  if (cmc !== null && cmc >= 6) tips.push('• This is a higher-cost card. Decks usually want ramp or cost reduction to cast it reliably.');
  if (manaCost && manaCost.includes('{X}')) tips.push('• X is chosen as you cast the spell, and it affects the total mana you pay.');

  const ensure = (arr: string[], fallback: string) => {
    if (arr.length === 0) arr.push(`• ${fallback}`);
  };
  ensure(why, 'People play this when it supports their deck’s plan (value, tempo, or a specific synergy).');
  ensure(patterns, 'Read the oracle text and look for the best timing window (early, mid, or late game).');
  ensure(gotchas, 'No major special rules notes beyond normal Magic rules.');
  ensure(tips, 'If you are unsure, ask: “What problem does this card solve for me right now?”');

  const examplePlay = buildExamplePlay(card);

  return [
    `1) What this card does`,
    ...what,
    ``,
    `2) Why people play it (Commander)`,
    ...why,
    ``,
    `3) Common play patterns`,
    ...patterns,
    ``,
    `4) Rules notes / gotchas`,
    ...gotchas,
    ``,
    `5) Quick tips`,
    ...tips,
    ``,
    `6) Example play`,
    ...examplePlay,
  ].join('\n');
}

/**
 * =========================
 * FREE "Standard synergies" — upgraded with mechanic detectors
 * =========================
 */
type Mechanics = {
  tokens: boolean;
  treasure: boolean;
  etb: boolean;
  blink: boolean;
  dies: boolean;
  sacrifice: boolean;
  aristocrats: boolean;
  counters: boolean;
  plusCounters: boolean;
  proliferate: boolean;
  graveyard: boolean;
  reanimate: boolean;
  selfMill: boolean;
  spellslinger: boolean;
  copySpells: boolean;
  costReduce: boolean;
  equipment: boolean;
  aura: boolean;
  artifacts: boolean;
  enchantments: boolean;
  lifegain: boolean;
  voltron: boolean;
  goWide: boolean;
  bigMana: boolean;
  manaSink: boolean;
  tribal: boolean;
  planeswalker: boolean;
};

function detectMechanics(card: ScryfallCard): Mechanics {
  const tl = getTypeLine(card).toLowerCase();
  const o = getOracleText(card).toLowerCase();
  const kw = (card.keywords ?? []).map((k) => k.toLowerCase());

  const has = (s: string) => o.includes(s);

  const tokens = has('token') || has('tokens') || has('create');
  const treasure = has('treasure');
  const etb = has('enters the battlefield') || /when .* enters/.test(o);
  const blink = has('exile') && (has('return') || has('then return')) && (has('to the battlefield') || has('under its owner'));
  const dies = has('dies') || /when .* dies/.test(o) || /whenever .* dies/.test(o);
  const sacrifice = has('sacrifice');
  const aristocrats = (dies || sacrifice) && (has('each opponent') || has('lose') || has('drain') || has('gain life'));
  const proliferate = has('proliferate');
  const plusCounters = has('+1/+1 counter') || has('+1/+1 counters');
  const counters = plusCounters || proliferate || has('counter on') || has('counters on');
  const graveyard = has('graveyard');
  const reanimate = (has('return') && has('graveyard')) || has('reanimate');
  const selfMill = has('mill') || has('surveil') || has('put the top') && has('into your graveyard');
  const spellslinger = has('instant') || has('sorcery') || has('whenever you cast') || has('magecraft') || has('storm');
  const copySpells = has('copy target') || has('copy that spell') || has('create a copy');
  const costReduce = has('cost') && (has('less to cast') || has('costs {') && has('less'));
  const equipment = tl.includes('equipment');
  const aura = tl.includes('aura');
  const artifacts = tl.includes('artifact') || has('artifact');
  const enchantments = tl.includes('enchantment') || has('enchantment');
  const lifegain = has('gain life') || has('lifelink') || kw.includes('lifelink');
  const voltron = (equipment || aura) && (tl.includes('creature') || has('enchanted creature'));
  const goWide = tokens || has('anthem') || has('creatures you control get');
  const bigMana = has('add {') || treasure || has('double') && has('mana');
  const manaSink = /{x}/.test(getManaCost(card).toLowerCase()) || has('pay') && has(':') && (has('draw') || has('create') || has('deal'));
  const planeswalker = tl.includes('planeswalker');

  // tribal detection (simple heuristic): "Creature — Elf Druid" => types after "—"
  const tribal = tl.includes('creature') && tl.includes('—') && tl.split('—')[1]?.trim().length > 0;

  return {
    tokens,
    treasure,
    etb,
    blink,
    dies,
    sacrifice,
    aristocrats,
    counters,
    plusCounters,
    proliferate,
    graveyard,
    reanimate,
    selfMill,
    spellslinger,
    copySpells,
    costReduce,
    equipment,
    aura,
    artifacts,
    enchantments,
    lifegain,
    voltron,
    goWide,
    bigMana,
    manaSink,
    tribal,
    planeswalker,
  };
}

function buildStandardSynergies(card: ScryfallCard): string {
  const tags = buildContextTags(card);
  const m = detectMechanics(card);

  const themes: string[] = [];
  const pairs: string[] = [];
  const patterns: string[] = [];
  const avoid: string[] = [];

  // Themes (more specific)
  if (m.aristocrats) themes.push('• Aristocrats (sacrifice + death triggers)');
  if (m.etb) themes.push('• ETB / Blink value');
  if (m.counters) themes.push('• Counters / Proliferate');
  if (m.spellslinger) themes.push('• Spellslinger / Cast triggers');
  if (m.graveyard) themes.push('• Graveyard / recursion');
  if (m.goWide) themes.push('• Go-wide tokens');
  if (m.voltron) themes.push('• Voltron (stacking buffs on one creature)');
  if (m.bigMana) themes.push('• Ramp / big mana');
  if (m.planeswalker) themes.push('• Planeswalker support');
  if (m.artifacts) themes.push('• Artifact synergies');
  if (m.enchantments) themes.push('• Enchantment synergies');
  if (m.tribal) themes.push('• Typal/tribal synergies (matching creature types)');
  if (themes.length === 0) themes.push('• General value / good-stuff');

  // Pairings (actionable, mechanic-based)
  if (m.etb) {
    pairs.push('• Blink/flicker effects (re-trigger ETB abilities for repeat value).');
    pairs.push('• Bounce-your-own effects (return it to hand and replay for ETB again).');
    patterns.push('• Pattern: resolve the ETB, then blink it on end step to do it again next turn.');
  }

  if (m.dies || m.sacrifice) {
    pairs.push('• Sacrifice outlets (free or repeatable ways to sacrifice creatures).');
    pairs.push('• Death triggers (“when a creature dies” payoffs like drain/draw/tokens).');
    pairs.push('• Token makers (cheap bodies to sacrifice).');
    patterns.push('• Pattern: make tokens → sacrifice them → collect value from death triggers.');
  }

  if (m.aristocrats) {
    pairs.push('• Life-drain payoffs and “each opponent loses life” effects (accelerates the win).');
    pairs.push('• Recursion (bring back fodder creatures to sacrifice again).');
  }

  if (m.plusCounters) {
    pairs.push('• Counter doublers (make each counter effect bigger).');
    pairs.push('• Proliferate (add extra counters without needing more triggers).');
    patterns.push('• Pattern: add counters early → proliferate midgame → swing with oversized threats.');
  }

  if (m.proliferate) {
    pairs.push('• Planeswalkers (proliferate grows loyalty fast).');
    pairs.push('• Any counter strategy: +1/+1 counters, poison, sagas, charge counters.');
    patterns.push('• Pattern: establish a counter source → proliferate to snowball advantage.');
  }

  if (m.graveyard) {
    pairs.push('• Self-mill / discard outlets (put useful cards into your graveyard on purpose).');
    pairs.push('• Reanimation / recursion (turn graveyard into extra “hand”).');
    avoid.push('• Graveyard hate (exile-based effects) can shut this down—consider protection or backup plans.');
  }

  if (m.reanimate) {
    pairs.push('• Big creatures/ETB creatures (reanimating a threat is strongest when it does something immediately).');
    pairs.push('• Discard/self-mill (to “load” targets into the graveyard).');
    patterns.push('• Pattern: bin a big threat → reanimate it → protect it for a full turn cycle.');
  }

  if (m.selfMill) {
    pairs.push('• Recursion and reanimation payoffs (you’re filling the graveyard as a resource).');
    pairs.push('• “Whenever a card goes to your graveyard” payoffs (if your deck has them).');
  }

  if (m.spellslinger) {
    pairs.push('• Cheap cantrips and interaction (cast multiple spells per turn to trigger payoffs).');
    pairs.push('• Cost reducers (lets you chain more spells in a turn).');
    pairs.push('• Spell copy effects (copying a strong spell often wins games).');
    patterns.push('• Pattern: hold mana → cast spells on opponents’ turns → keep triggering value engines.');
  }

  if (m.copySpells) {
    pairs.push('• Big-impact instants/sorceries (copy your best spell for huge swings).');
    pairs.push('• “Cast triggers” cards (copies often still count as spells on the stack).');
  }

  if (m.treasure) {
    pairs.push('• “Artifacts matter” cards (Treasures are artifacts).');
    pairs.push('• Big spells / mana sinks (Treasures convert into explosive turns).');
    patterns.push('• Pattern: bank Treasures → spend them all for a big turn where you pull ahead.');
  }

  if (m.tokens && !m.treasure) {
    pairs.push('• Anthem effects (make many small bodies into real threats).');
    pairs.push('• Sac outlets (convert tokens into cards/mana/life).');
    patterns.push('• Pattern: go wide → buff once → swing for big damage.');
  }

  if (m.equipment) {
    pairs.push('• Creatures with evasion (flying/menace) or combat damage triggers.');
    pairs.push('• “Voltron” commanders (one creature gets huge and ends games quickly).');
    avoid.push('• Equipment can be slow if you don’t have creatures to equip—make sure you have enough bodies.');
  }

  if (m.aura) {
    pairs.push('• Hexproof/ward/protection creatures (reduces the risk of getting 2-for-1’d).');
    pairs.push('• Totem armor (if available in your colors) helps prevent blowouts.');
    avoid.push('• Auras are fragile vs instant-speed removal—prefer casting when opponents are tapped out.');
  }

  if (m.lifegain) {
    pairs.push('• “Whenever you gain life” payoffs (counters, tokens, draw, drain).');
    pairs.push('• Repeatable lifegain sources (small gains each turn add up).');
  }

  if (m.bigMana) {
    pairs.push('• Expensive commanders / big spells (you reach them sooner).');
    pairs.push('• Mana sinks (activated abilities or X spells to dump extra mana).');
    patterns.push('• Pattern: ramp early → stabilize midgame → win with a huge turn.');
  }

  if (m.manaSink) {
    pairs.push('• Extra mana sources (ramp) so you can scale the ability/spell harder.');
    pairs.push('• Untap effects (if it’s an activated ability) to use it multiple times.');
  }

  if (tags.includes('removal')) {
    pairs.push('• Card draw (removal + draw = you answer threats without running out of gas).');
    pairs.push('• Recursion (replay removal effects if you can).');
  }

  if (tags.includes('countermagic')) {
    pairs.push('• Draw engines (counterspells are best when you always have one available).');
    pairs.push('• Cheap interaction suite (keep control without falling behind).');
  }

  if (pairs.length === 0) {
    pairs.push('• Cards that share the same resource (mana, cards, tokens) or strategy (tempo/value).');
    patterns.push('• Pattern: use this card to gain advantage, then protect that advantage.');
  }

  if (avoid.length === 0) avoid.push('• Avoid including this if it does not support your deck’s main plan.');

  return [
    `A) Best deck themes for this card`,
    ...themes,
    ``,
    `B) What this card pairs well with`,
    ...pairs,
    ``,
    `C) Common synergy patterns (how it “plays out”)`,
    ...(patterns.length ? patterns : ['• No special pattern detected—treat it as flexible value.']),
    ``,
    `D) Anti-synergies / what to avoid`,
    ...avoid,
  ].join('\n');
}

// ---- Manual explainers (~20 staples) ----
const MANUAL_EXPLAINERS: Record<
  string,
  {
    title: string;
    short: string;
    why: string[];
    tips: string[];
    gotchas?: string[];
  }
> = {
  'Sol Ring': {
    title: 'Sol Ring',
    short: 'One of the strongest early-game mana rocks ever printed.',
    why: [
      'Turns 1 mana into 2 colorless (net +1) every turn.',
      'Accelerates you into your commander and big plays much earlier.',
      'Fits almost any Commander deck (unless you have a specific reason not to).',
    ],
    tips: ['Best on turn 1 or 2; early ramp matters most.', 'If you need colors, pair with colored fixing.'],
    gotchas: ['You may become the “target” if you start too fast — table politics matters.'],
  },
  'Command Tower': {
    title: 'Command Tower',
    short: 'Fixes colors in Commander: taps for any color in your commander’s identity.',
    why: ['Perfect mana fixing in most Commander decks.', 'No real downside in Commander.'],
    tips: ['Almost always an auto-include in multicolor Commander decks.'],
  },
  'Arcane Signet': {
    title: 'Arcane Signet',
    short: 'A 2-mana rock that taps for any color in your commander’s identity.',
    why: ['Reliable color fixing + ramp.', 'Helps cast your commander on curve.'],
    tips: ['Great keep in opening hands if you have lands to cast it.'],
  },
  'Swords to Plowshares': {
    title: 'Swords to Plowshares',
    short: 'One of the best single-target creature removals ever printed.',
    why: ['Exiles (beats indestructible & many death triggers).', 'Only 1 mana.'],
    tips: ['Save it for the scariest creature, not the first creature.'],
    gotchas: ['Opponent gains life — usually worth it.'],
  },
  'Path to Exile': {
    title: 'Path to Exile',
    short: 'Efficient exile removal that gives the opponent a basic land.',
    why: ['Exiles for 1 mana.', 'Stops indestructible and recursion lines.'],
    tips: ['Use on the biggest threat, or when the extra land won’t matter much.'],
    gotchas: ['Ramp is real — be careful early game.'],
  },
  'Rhystic Study': {
    title: 'Rhystic Study',
    short: 'Tax effect that draws you cards when opponents don’t pay 1.',
    why: ['Generates massive card advantage over a game.', 'Forces opponents into awkward choices.'],
    tips: ['Say “Pay the 1?” consistently. Track triggers carefully.'],
    gotchas: ['You will draw heat if you draw too much.'],
  },
  'Smothering Tithe': {
    title: 'Smothering Tithe',
    short: 'Creates Treasure when opponents draw unless they pay 2.',
    why: ['Explosive mana advantage.', 'Treasures fix colors and enable big turns.'],
    tips: ['Convert Treasures into immediate advantage before it gets removed.'],
    gotchas: ['It usually eats removal quickly.'],
  },
  'Cyclonic Rift': {
    title: 'Cyclonic Rift',
    short: 'Overloaded: bounces all nonlands you don’t control (one-sided reset).',
    why: ['Massive tempo swing.', 'Breaks board stalls and opens lethal attacks.'],
    tips: ['Often best cast on the end step before your turn.'],
    gotchas: ['Doesn’t permanently answer threats; they can replay them.'],
  },
  'Demonic Tutor': {
    title: 'Demonic Tutor',
    short: 'Search your library for any card (best-in-class tutor).',
    why: ['Finds answers or win conditions.', 'Increases consistency hugely.'],
    tips: ['Tutor with a plan: “What am I doing the next 2 turns?”'],
    gotchas: ['Some tables dislike tutors because games feel repetitive.'],
  },
  'Cultivate': {
    title: 'Cultivate',
    short: 'Classic green ramp: one basic to battlefield tapped, one to hand.',
    why: ['Fixes colors + ramps.', 'Smooths land drops for future turns.'],
    tips: ['Pick basics that fix your next 2 turns of casting.'],
  },
  'Kodama’s Reach': {
    title: 'Kodama’s Reach',
    short: 'Functionally Cultivate #2.',
    why: ['Redundancy for consistent ramp.'],
    tips: ['Same plan as Cultivate — think ahead about colors.'],
  },
  'Lightning Greaves': {
    title: 'Lightning Greaves',
    short: 'Gives haste + shroud for 0 equip (protects and enables).',
    why: ['Protects key creatures/commanders.', 'Allows immediate attacks/activations.'],
    tips: ['Move Greaves at the right moment: equip when you need protection.'],
    gotchas: ['Shroud stops YOU from targeting your creature too.'],
  },
  'Swiftfoot Boots': {
    title: 'Swiftfoot Boots',
    short: 'Gives haste + hexproof; equip costs 1.',
    why: ['Protection without the shroud downside.', 'Still enables immediate value.'],
    tips: ['If you need to target your own creature often, Boots > Greaves.'],
  },
  'Esper Sentinel': {
    title: 'Esper Sentinel',
    short: 'Early tax creature that draws cards when opponents cast noncreature spells.',
    why: ['Great turn-1 play in white.', 'Punishes early rocks/removal/draw.'],
    tips: ['Buff its power to increase the tax.'],
  },
  'The One Ring': {
    title: 'The One Ring',
    short: 'Protection for a turn + scalable card draw (with a life-cost clock).',
    why: ['Immediate safety and huge card advantage.', 'Fits many decks.'],
    tips: ['Plan how you’ll remove/reset burden counters (bounce/sac/clone).'],
    gotchas: ['Burden counters drain life — don’t get greedy under pressure.'],
  },
  'Fabled Passage': {
    title: 'Fabled Passage',
    short: 'Fetches a basic land; untaps it if you have 4+ lands.',
    why: ['Fixes colors.', 'Shuffles for topdeck manipulation.'],
    tips: ['Hold it if you care about landfall or want the untap.'],
  },
  'Evolving Wilds': {
    title: 'Evolving Wilds',
    short: 'Simple basic-land fetch; good budget fixing.',
    why: ['Fixes colors on a budget.'],
    tips: ['Use early to fix colors; it effectively “enters tapped” because you fetch tapped.'],
  },
  'Mystic Remora': {
    title: 'Mystic Remora',
    short: 'Early-game draw engine vs noncreature spells; upkeep tax grows.',
    why: ['Punishes fast mana and early interaction.', 'Draws a lot early.'],
    tips: ['Often correct to let it die after 1–2 upkeeps.'],
  },
  'Brainstorm': {
    title: 'Brainstorm',
    short: 'Draw 3, put 2 back — best with shuffle effects.',
    why: ['Fixes hands and hides key cards.', 'Combos with fetchlands to “clean” the top.'],
    tips: ['Try to pair with a shuffle (Fabled Passage, Evolving Wilds, etc.).'],
    gotchas: ['Without a shuffle, you can get stuck drawing the same bad cards.'],
  },
};

const MANUAL_KEYS = new Set(Object.keys(MANUAL_EXPLAINERS).map((k) => normalizeName(k)));

function asPlainTextWithBullets(s: string) {
  return s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

/**
 * =========================
 * Main Page
 * =========================
 */
export default function Page() {
  // search UI
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // selection
  const [selectedName, setSelectedName] = useState<string>('');
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  // tabs
  const [activeTab, setActiveTab] = useState<'explain' | 'synergies' | 'glossary'>('explain');

  // preferences
  const [preferManual, setPreferManual] = useState(true);

  // AI controls (hybrid)
  const [enableAI, setEnableAI] = useState(false);
  const [autoFetchAI, setAutoFetchAI] = useState(false);

  // outputs
  const [manualExplain, setManualExplain] = useState<string | null>(null);
  const [standardExplain, setStandardExplain] = useState<string | null>(null);
  const [standardSynergies, setStandardSynergies] = useState<string | null>(null);

  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [aiSynergies, setAiSynergies] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // tooltips (Option A)
  const [openKey, setOpenKey] = useState<string | null>(null);

  // glossary
  const [glossaryQuery, setGlossaryQuery] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close tooltip when clicking outside OR hitting ESC
  useEffect(() => {
    const onDocClick = () => setOpenKey(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Scryfall suggestions (autocomplete)
  useEffect(() => {
    let alive = true;
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const run = async () => {
      setIsSuggesting(true);
      try {
        const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await safeJson(res);

        const names: string[] = Array.isArray(data?.data) ? data.data.slice(0, 8) : [];
        const results: Suggestion[] = [];

        // Fetch a small amount of card data so we can show images in the dropdown
        for (const name of names.slice(0, 6)) {
          const r = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
          const c = (await safeJson(r)) as ScryfallCard | null;
          results.push({
            id: c?.id ?? name,
            name,
            image: c?.image_uris?.small ?? c?.card_faces?.[0]?.image_uris?.small ?? null,
            type_line: c?.type_line ?? c?.card_faces?.[0]?.type_line ?? undefined,
            mana_cost: c?.mana_cost ?? c?.card_faces?.[0]?.mana_cost ?? undefined,
          });
        }

        if (!alive) return;
        setSuggestions(results);
        setShowDropdown(true);
      } catch {
        if (!alive) return;
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        if (!alive) return;
        setIsSuggesting(false);
      }
    };

    const t = setTimeout(run, 160);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  async function loadCardByName(name: string) {
    const n = name.trim();
    if (!n) return;
    setSelectedName(n);
    setIsLoadingCard(true);
    setAiError(null);
    setAiExplain(null);
    setAiSynergies(null);

    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(n)}`);
      const c = (await safeJson(res)) as ScryfallCard | null;
      if (!c || !c.name) throw new Error('Card not found');

      setCard(c);

      const norm = normalizeName(c.name);
      const manual = MANUAL_KEYS.has(norm) ? MANUAL_EXPLAINERS[c.name]?.short ?? null : null;

      // Manual block (more detailed) if present
      if (MANUAL_KEYS.has(norm) && MANUAL_EXPLAINERS[c.name]) {
        const m = MANUAL_EXPLAINERS[c.name];
        const lines = [
          `${m.title}`,
          ``,
          `${m.short}`,
          ``,
          `Why people play it`,
          ...m.why.map((x) => `• ${x}`),
          ``,
          `Quick tips`,
          ...m.tips.map((x) => `• ${x}`),
          ...(m.gotchas?.length
            ? [
                ``,
                `Gotchas`,
                ...m.gotchas.map((x) => `• ${x}`),
              ]
            : []),
        ];
        setManualExplain(lines.join('\n'));
      } else {
        setManualExplain(null);
      }

      // Standard (free)
      setStandardExplain(buildStandardExplanation(c));
      setStandardSynergies(buildStandardSynergies(c));

      // Auto-fetch AI if enabled
      if (enableAI && autoFetchAI) {
        if (activeTab === 'synergies') {
          await fetchAI('synergies', c);
        } else {
          await fetchAI('explain', c);
        }
      }
    } catch (e: any) {
      setCard(null);
      setManualExplain(null);
      setStandardExplain(null);
      setStandardSynergies(null);
      setAiError(e?.message ?? 'Failed to load card.');
    } finally {
      setIsLoadingCard(false);
      setShowDropdown(false);
    }
  }

  async function fetchAI(mode: 'explain' | 'synergies', c: ScryfallCard) {
    setAiLoading(true);
    setAiError(null);
    try {
      const body = {
        mode,
        card: {
          name: c.name,
          mana_cost: getManaCost(c),
          type_line: getTypeLine(c),
          oracle_text: getOracleText(c),
          tags: buildContextTags(c),
        },
      };

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data?.error ?? 'AI request failed.');
      }

      const text = (data?.text ?? data?.explanation ?? data?.result ?? '').toString().trim();
      if (!text) throw new Error('AI returned empty text.');

      if (mode === 'explain') setAiExplain(text);
      else setAiSynergies(text);
    } catch (e: any) {
      setAiError(e?.message ?? 'AI request failed.');
    } finally {
      setAiLoading(false);
    }
  }

  function onSearch() {
    loadCardByName(query);
  }

  const cardImage = useMemo(() => getBestCardImage(card), [card]);
  const oracleText = useMemo(() => getOracleText(card), [card]);
  const typeLine = useMemo(() => getTypeLine(card), [card]);
  const manaCost = useMemo(() => getManaCost(card), [card]);
  const roleSpeed = useMemo(() => (card ? inferRoleAndSpeed(card) : null), [card]);

  const standardModeText = useMemo(() => {
    if (!card) return null;
    if (activeTab === 'synergies') return standardSynergies;
    return standardExplain;
  }, [card, activeTab, standardExplain, standardSynergies]);

  const filteredGlossary = useMemo(() => {
    const q = glossaryQuery.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter((item) => {
      const hay = `${item.term} ${item.meaning} ${item.details ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [glossaryQuery]);

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Explain My Card</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Search any Magic card. Get a clear explanation + beginner-friendly synergies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={preferManual}
                onChange={(e) => setPreferManual(e.target.checked)}
              />
              Prefer manual explainer first
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={enableAI}
                onChange={(e) => {
                  setEnableAI(e.target.checked);
                  if (!e.target.checked) {
                    setAutoFetchAI(false);
                    setAiExplain(null);
                    setAiSynergies(null);
                    setAiError(null);
                  }
                }}
              />
              Enable AI (optional)
            </label>

            <label className={cx(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
              enableAI ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-900 bg-zinc-900/10 text-zinc-600'
            )}>
              <input
                type="checkbox"
                checked={autoFetchAI}
                disabled={!enableAI}
                onChange={(e) => setAutoFetchAI(e.target.checked)}
              />
              Auto-fetch AI
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedName('');
                }}
                onFocus={() => setShowDropdown(suggestions.length > 0)}
                placeholder="Type a card name... (e.g., Sol Ring, Rhystic Study, Lightning Greaves)"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-600"
              />
              {showDropdown && suggestions.length > 0 ? (
                <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="flex w-full items-center gap-3 border-b border-zinc-900 px-3 py-2 text-left hover:bg-zinc-900/60"
                      onClick={() => {
                        setQuery(s.name);
                        setShowDropdown(false);
                        loadCardByName(s.name);
                      }}
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-900">
                        {s.image ? <img src={s.image} alt={s.name} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{s.name}</div>
                        <div className="truncate text-xs text-zinc-400">
                          {s.mana_cost ? <span className="mr-2">{s.mana_cost}</span> : null}
                          {s.type_line ?? ''}
                        </div>
                      </div>
                    </button>
                  ))}
                  <div className="px-3 py-2 text-xs text-zinc-500">
                    Tip: click a dropdown result to load instantly (best accuracy).
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={onSearch}
              className="rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-white"
            >
              Search
            </button>
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Tip: Example play is included in the standard (free) explanation.
          </div>
        </div>

        {/* Main */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Card panel */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Card</h2>
                {roleSpeed && card ? (
                  <div className="flex gap-2">
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200">
                      Role: {roleSpeed.role}
                    </span>
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200">
                      Speed: {roleSpeed.speed}
                    </span>
                  </div>
                ) : null}
              </div>

              {isLoadingCard ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Loading card...
                </div>
              ) : !card ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Search for a card to see it here.
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <div className="text-xl font-bold">{card.name}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {manaCost ? <span className="mr-2">{manaCost}</span> : null}
                      {typeLine}
                    </div>
                  </div>

                  {cardImage ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                      <img src={cardImage} alt={card.name} className="w-full object-cover" />
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs font-semibold text-zinc-300">Oracle text (plain)</div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{oracleText || '—'}</pre>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Explanation panel */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200">Explanation</h2>
                  <div className="text-xs text-zinc-500">Tooltips show here (not in oracle text).</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={cx(
                      'rounded-full px-4 py-2 text-xs font-semibold',
                      activeTab === 'explain'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900/60'
                    )}
                    onClick={() => setActiveTab('explain')}
                  >
                    Explain
                  </button>
                  <button
                    className={cx(
                      'rounded-full px-4 py-2 text-xs font-semibold',
                      activeTab === 'synergies'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900/60'
                    )}
                    onClick={() => setActiveTab('synergies')}
                  >
                    Synergies
                  </button>
                  <button
                    className={cx(
                      'rounded-full px-4 py-2 text-xs font-semibold',
                      activeTab === 'glossary'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900/60'
                    )}
                    onClick={() => setActiveTab('glossary')}
                  >
                    Glossary
                  </button>

                  {enableAI ? (
                    <button
                      className={cx(
                        'rounded-full px-4 py-2 text-xs font-semibold',
                        'border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900/60'
                      )}
                      onClick={() => {
                        if (!card) return;
                        if (activeTab === 'synergies') fetchAI('synergies', card);
                        else fetchAI('explain', card);
                      }}
                      disabled={!card || aiLoading}
                    >
                      {activeTab === 'synergies' ? 'Try AI synergies' : 'Try AI'}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* AI error */}
              {aiError ? (
                <div className="mt-3 rounded-2xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
                  {aiError}
                </div>
              ) : null}

              {/* Content */}
              {activeTab === 'glossary' ? (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <input
                      value={glossaryQuery}
                      onChange={(e) => setGlossaryQuery(e.target.value)}
                      placeholder="Search glossary... (e.g., ETB, trample, removal)"
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-600"
                    />
                  </div>

                  <div className="mt-3 max-h-[520px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    {filteredGlossary.length === 0 ? (
                      <div className="p-3 text-sm text-zinc-400">No glossary matches.</div>
                    ) : (
                      <div className="space-y-2">
                        {filteredGlossary.map((g) => (
                          <div key={g.term} className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-zinc-100">{g.term}</div>
                              <div className="text-xs text-zinc-400">{g.meaning}</div>
                            </div>
                            {g.details ? (
                              <div className="mt-2 text-sm text-zinc-200">{g.details}</div>
                            ) : null}
                            {g.tags?.length ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {g.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full border border-zinc-800 bg-zinc-900/30 px-2 py-0.5 text-[11px] text-zinc-300"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-zinc-500">
                    Tip: Glossary includes abilities (deathtouch, flying, trample, etc.) plus acronyms (ETB/MV) and slang (ramp, board wipe).
                  </div>
                </div>
              ) : (
                <>
                  {/* Manual / Standard header */}
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-zinc-100">
                            {activeTab === 'synergies' ? 'Standard synergies (free)' : 'Standard explanation (free)'}
                          </div>
                          <div className="text-xs text-zinc-400">Generated locally from oracle text + simple rules.</div>
                        </div>
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200">
                          Free mode
                        </span>
                      </div>

                      <div className="mt-3">
                        {!card ? (
                          <div className="text-sm text-zinc-400">Search a card to generate {activeTab === 'synergies' ? 'synergies' : 'an explanation'}.</div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm text-zinc-100">
                            {renderTextWithTooltips(asPlainTextWithBullets(standardModeText ?? ''), openKey, setOpenKey)}
                          </pre>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-zinc-100">AI {activeTab === 'synergies' ? 'synergies' : 'explanation'}</div>
                          <div className="text-xs text-zinc-400">Optional: richer + more specific (requires API credits).</div>
                        </div>
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200">
                          {enableAI ? 'AI enabled' : 'AI off'}
                        </span>
                      </div>

                      <div className="mt-3">
                        {!enableAI ? (
                          <div className="text-sm text-zinc-500">Enable AI to use this. Free mode is always available.</div>
                        ) : aiLoading ? (
                          <div className="text-sm text-zinc-400">Loading AI…</div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm text-zinc-100">
                            {activeTab === 'synergies'
                              ? aiSynergies || 'No AI synergies yet. Click “Try AI synergies”.'
                              : aiExplain || 'No AI explanation yet. Click “Try AI”.'}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Manual explainer (if present) */}
                  {card && manualExplain && (preferManual || activeTab === 'explain') ? (
                    <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="text-sm font-semibold text-zinc-100">Manual explainer (staples)</div>
                      <div className="mt-2 text-xs text-zinc-400">
                        For common staples you’ll see a human-written explainer here. AI is optional for extra detail.
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-sm text-zinc-100">{manualExplain}</pre>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
                    Tip: Click a highlighted word in Explanation/Synergies for a definition. Press Escape to close tooltips.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}