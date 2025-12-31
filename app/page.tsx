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

  if (o.includes('draw a card') || o.includes('draw two') || o.includes('draw three') || o.includes('draw')) tags.push('card-draw');
  if (o.includes('treasure')) tags.push('treasure');
  if (o.includes('create') && (o.includes('token') || o.includes('tokens'))) tags.push('tokens');
  if (o.includes('counter target') || o.includes('counterspell')) tags.push('countermagic');
  if (o.includes('destroy') || o.includes('exile')) tags.push('removal');
  if (o.includes('each opponent')) tags.push('each-opponent');
  if (o.includes('whenever you cast')) tags.push('cast-triggers');
  if (o.includes('enters the battlefield')) tags.push('etb');
  if (o.includes('sacrifice')) tags.push('sacrifice');
  if (o.includes('graveyard')) tags.push('graveyard');
  if (o.includes('search your library')) tags.push('tutor-or-search');
  if (o.includes('add {') || o.includes('adds {') || o.includes('add one mana') || o.includes('add two mana')) tags.push('mana');

  return Array.from(new Set(tags));
}

/**
 * =========================
 * Keyword tooltips (FREE)
 * =========================
 * - Hover shows tooltip
 * - Click "pins" it open
 * - Only one tooltip open at a time
 * - Only the FIRST occurrence of a keyword in a block is underlined (prevents messy UI)
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
  exile: 'Exile: Move a card to the exile zone. It is not in the graveyard, and many recursion effects cannot get it back.',
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

function renderTextWithTooltips(
  text: string,
  openKey: string | null,
  setOpenKey: (k: string | null) => void,
  pinnedKey: string | null,
  setPinnedKey: (k: string | null) => void
): React.ReactNode {
  if (!text) return null;

  const keys = Object.keys(KEYWORD_DEFINITIONS).sort((a, b) => b.length - a.length);
  const pattern = keys.map((k) => escapeRegex(k)).join('|');
  const re = new RegExp(`(${pattern})`, 'gi');

  // Track first occurrence per keyword within this block (prevents underline spam)
  const seen = new Set<string>();

  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const parts = line.split(re);

    const renderedLine = parts.map((part, idx) => {
      const matchKey = keys.find((k) => k.toLowerCase() === part.toLowerCase());
      if (!matchKey) return <React.Fragment key={`${lineIdx}-${idx}`}>{part}</React.Fragment>;

      const norm = matchKey.toLowerCase();
      if (seen.has(norm)) {
        return <React.Fragment key={`${lineIdx}-${idx}`}>{part}</React.Fragment>;
      }
      seen.add(norm);

      const isOpen = openKey === matchKey || pinnedKey === matchKey;
      const definition = KEYWORD_DEFINITIONS[matchKey];

      return (
        <span key={`${lineIdx}-${idx}`} className="relative inline-flex items-baseline">
          <span
            className={cx(
              'mx-0.5 rounded px-1 py-0.5 font-semibold',
              'underline decoration-zinc-600 underline-offset-2',
              'hover:bg-zinc-800/60',
              'text-zinc-100 cursor-help'
            )}
            onMouseEnter={() => {
              if (!pinnedKey) setOpenKey(matchKey);
            }}
            onMouseLeave={() => {
              if (!pinnedKey) setOpenKey(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              const next = pinnedKey === matchKey ? null : matchKey;
              setPinnedKey(next);
              setOpenKey(null);
            }}
            role="button"
            aria-label={`${matchKey} definition`}
            aria-expanded={isOpen}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const next = pinnedKey === matchKey ? null : matchKey;
                setPinnedKey(next);
                setOpenKey(null);
              }
              if (e.key === 'Escape') {
                setPinnedKey(null);
                setOpenKey(null);
              }
            }}
          >
            {part}
          </span>

          <span
            className={cx(
              'absolute left-0 top-full z-50 mt-2 w-[min(320px,80vw)]',
              'rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow-xl',
              'transition-opacity',
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            role="tooltip"
          >
            <span className="block text-zinc-100">{definition}</span>
            <span className="mt-1 block text-[11px] text-zinc-400">Hover = preview • Click = pin • Esc = close</span>
          </span>
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
 * Glossary (Acronyms + shorthand)
 * + Keyword abilities list
 * =========================
 */
type GlossaryItem = {
  term: string;
  meaning: string;
  details?: string;
  tags?: string[];
};

const GLOSSARY: GlossaryItem[] = [
  { term: 'ETB', meaning: 'Enters the Battlefield', details: 'Triggered abilities that happen when a permanent enters the battlefield.', tags: ['trigger', 'battlefield'] },
  { term: 'LTB', meaning: 'Leaves the Battlefield', details: 'Triggered abilities that happen when a permanent leaves the battlefield (dies, exiled, bounced, etc.).', tags: ['trigger', 'battlefield'] },
  { term: 'Dies', meaning: 'Goes from battlefield to graveyard', details: '“Dies” specifically means it went to a graveyard from the battlefield.', tags: ['rules'] },
  { term: 'CMC', meaning: 'Converted Mana Cost (older term)', details: 'Modern rules usually say “Mana Value (MV)”. They mean the same thing.', tags: ['mana'] },
  { term: 'MV', meaning: 'Mana Value', details: 'A number representing the total mana cost (ignores color). Example: {2}{U} has MV 3.', tags: ['mana'] },
  { term: '{T}', meaning: 'Tap symbol', details: 'If an ability has {T} in the cost, you tap the permanent to activate it.', tags: ['symbols'] },
  { term: '{C}', meaning: 'Colorless mana', details: 'This is colorless mana. It is not the same as “any color”.', tags: ['symbols', 'mana'] },
  { term: 'P/T', meaning: 'Power / Toughness', details: 'Power is damage dealt; toughness is how much damage it can take before dying.', tags: ['combat'] },
  { term: '+1/+1', meaning: 'Stat bonus', details: 'Adds +1 power and +1 toughness (often via counters or effects).', tags: ['combat'] },
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

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * FREE, deterministic "Standard explanation"
 */
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
  if (tags.includes('removal')) what.push('• Removes or answers a threat (often by destroying or exiling).');
  if (tags.includes('tokens')) what.push('• Creates creature tokens or other tokens, which can build a board quickly.');
  if (tags.includes('countermagic')) what.push('• Can stop an opponent’s spell by countering it (it does not resolve).');
  if (tags.includes('graveyard')) what.push('• Interacts with the graveyard (yours or opponents’).');
  if (tags.includes('tutor-or-search')) what.push('• Lets you search your library for a card or land (increases consistency).');
  if (tl.includes('creature') && (card.power || card.toughness)) what.push(`• It is a creature (${card.power ?? '?'} / ${card.toughness ?? '?'}). It can attack and block.`);
  if (tl.includes('planeswalker')) what.push('• It is a planeswalker. You activate one loyalty ability per turn (on your turn).');

  if (what.length === 0)
    what.push(
      oracle.trim()
        ? '• This card’s main effect is described in its oracle text below.'
        : '• This card does not have oracle text (or it was not available from Scryfall).'
    );

  why.push('• In Commander, cards that create value, tempo, or answers tend to perform well over long games.');

  if (tags.includes('mana')) patterns.push('• Play it early if possible, then use the extra mana immediately.');
  if (tags.includes('card-draw')) patterns.push('• Use it when you have mana available and can safely spend a turn drawing.');
  if (tags.includes('removal')) patterns.push('• Hold it for the most dangerous threat, not the first creature you see.');

  if (o.includes('target')) gotchas.push('• This card targets. If the target becomes illegal, the effect may fail.');
  if (o.includes('exile')) gotchas.push('• Exile is different from destroy: it usually prevents most recursion.');
  if (o.includes('until end of turn')) gotchas.push('• “Until end of turn” effects wear off during the cleanup step at the end of the turn.');
  if (tl.includes('equipment')) gotchas.push('• Equipment must be attached by paying its equip cost (normally only as a sorcery).');
  if (tl.includes('aura')) gotchas.push('• Auras target when cast. If the target is illegal, the Aura does not resolve.');

  tips.push('• If you are unsure, ask: “What problem does this card solve for me right now?”');
  if (cmc !== null && cmc >= 6) tips.push('• Higher-cost cards usually want ramp or cost reduction to cast reliably.');
  if (manaCost && manaCost.includes('{X}')) tips.push('• X is chosen as you cast the spell, and it affects the total mana you pay.');

  const ensure = (arr: string[], fallback: string) => {
    if (arr.length === 0) arr.push(`• ${fallback}`);
  };
  ensure(patterns, 'Read the oracle text and look for the best timing window (early, mid, or late game).');
  ensure(gotchas, 'No major special rules notes beyond normal Magic rules.');

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
  ].join('\n');
}

function buildStandardSynergies(card: ScryfallCard): string {
  const typeLine = getTypeLine(card).toLowerCase();
  const oracle = getOracleText(card).toLowerCase();
  const tags = buildContextTags(card);

  const themes: string[] = [];
  const pairs: string[] = [];
  const infin: string[] = [];
  const avoid: string[] = [];

  if (tags.includes('artifact')) themes.push('• Artifacts');
  if (tags.includes('enchantment')) themes.push('• Enchantments');
  if (tags.includes('instant') || tags.includes('sorcery') || tags.includes('cast-triggers'))
    themes.push('• Spellslinger (many instants/sorceries)');
  if (tags.includes('tokens')) themes.push('• Token swarm / go-wide');
  if (tags.includes('graveyard')) themes.push('• Graveyard / recursion');
  if (tags.includes('sacrifice')) themes.push('• Sacrifice / aristocrats');
  if (tags.includes('mana')) themes.push('• Ramp / big mana');
  if (oracle.includes('lifelink') || oracle.includes('gain life')) themes.push('• Lifegain');

  if (themes.length === 0) themes.push('• General value / good-stuff');

  if (tags.includes('mana')) {
    pairs.push('• Big spells and expensive commanders (you reach them sooner).');
    pairs.push('• Card draw (extra mana + extra cards = more options).');
    pairs.push('• Mana sinks (activated abilities you can dump mana into).');
  }
  if (tags.includes('card-draw')) {
    pairs.push('• Cheap interaction (use extra cards to keep pace).');
    pairs.push('• Cost reducers (cast more spells per turn).');
    pairs.push('• “Whenever you draw” payoff cards (if your deck has them).');
  }
  if (tags.includes('tokens')) {
    pairs.push('• Anthem effects (make small tokens into real threats).');
    pairs.push('• Sacrifice outlets (convert tokens into value).');
    pairs.push('• ETB triggers (if tokens enter the battlefield often).');
  }
  if (tags.includes('removal')) {
    pairs.push('• Board control shells (removal + card advantage).');
    pairs.push('• Recursion (replay the removal if your deck can).');
  }
  if (tags.includes('graveyard')) {
    pairs.push('• Self-mill (fill your graveyard with options).');
    pairs.push('• Sacrifice outlets (put things in the graveyard intentionally).');
    pairs.push('• Reanimation / recursion spells (bring things back).');
  }
  if (typeLine.includes('equipment')) {
    pairs.push('• Creatures with strong combat triggers (haste/evasion helps).');
    pairs.push('• Cheap creatures (more targets for Equipment).');
  }
  if (pairs.length === 0) pairs.push('• Cards that share the same theme or resource (mana, tokens, graveyard, etc.).');

  infin.push('• Free mode: no detailed infinite combo lines.');
  infin.push('• Premium idea later: show specific combo examples with caution notes.');

  if (oracle.includes('exile your graveyard') || oracle.includes('exile all cards from your graveyard')) {
    avoid.push('• Can conflict with graveyard-heavy strategies (you may remove your own resources).');
  }
  if (typeLine.includes('aura')) {
    avoid.push('• Aura plans can be fragile if opponents have instant-speed removal.');
  }
  if (tags.includes('mana') && oracle.includes('colorless')) {
    avoid.push('• If your deck needs lots of colored mana, pair with good fixing.');
  }
  if (avoid.length === 0) avoid.push('• Avoid including this if it does not support your deck’s main plan.');

  return [
    `A) Best deck themes for this card`,
    ...themes,
    ``,
    `B) What this card pairs well with`,
    ...pairs,
    ``,
    `C) If you want to go infinite (optional)`,
    ...infin,
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
};

/**
 * =========================
 * Premium Split (Commander)
 * =========================
 */
type CommanderSnapshot = {
  role: string;
  speed: string;
  complexity: string;
  tableImpact?: string;
};

type CommanderSection = {
  id: string;
  title: string;
  body: string;
  premium: boolean;
};

type CommanderSplit = {
  snapshot: CommanderSnapshot;
  summary: string;
  free: CommanderSection[];
  paid: CommanderSection[];
};

function buildSolRingCommanderSections(): CommanderSplit {
  const snapshot: CommanderSnapshot = {
    role: 'Ramp',
    speed: 'Early',
    complexity: 'Beginner',
    tableImpact: 'Medium–High (can draw attention if played early)',
  };

  const summary =
    'In Commander, Sol Ring is mainly used to jump ahead on mana early, letting you cast your commander and powerful spells much faster than the table.';

  const free: CommanderSection[] = [
    {
      id: 'what',
      title: 'What this card does (plain English)',
      premium: false,
      body: [
        '• You pay 1 mana to cast Sol Ring.',
        '• You can tap it to make 2 colorless mana every turn.',
        '• That means it can pay for itself immediately and then keep giving you extra mana.',
        '',
        'In simple terms: Sol Ring turns 1 mana into 2 mana every turn, starting the turn it enters.',
      ].join('\n'),
    },
    {
      id: 'why',
      title: 'Why people play this in Commander (high-level)',
      premium: false,
      body: [
        '• Commander games are slower and more expensive than 1v1 formats.',
        '• Extra mana early often decides who gets ahead.',
        '• Sol Ring is one of the most efficient ramp cards ever printed.',
        '',
        'In multiplayer, getting ahead early means more options, which often leads to winning.',
      ].join('\n'),
    },
  ];

  const paid: CommanderSection[] = [
    {
      id: 'timing',
      title: 'When to play Sol Ring (timing matters)',
      premium: true,
      body: [
        'Early game:',
        '• Best time to play it is turn 1–2. It often lets you cast your commander 1–2 turns early.',
        '• Risk: playing it immediately can make you look like the threat.',
        '',
        'Mid game:',
        '• Still useful for double-spelling and powering mana sinks / activated abilities.',
        '',
        'Late game:',
        '• Least impactful stage. Still helps pay costs, but it’s no longer game-defining.',
      ].join('\n'),
    },
    {
      id: 'examples',
      title: 'Example plays (Commander coaching)',
      premium: true,
      body: [
        'Example 1 — Early game:',
        '• Turn 1 land → Sol Ring → pass. Turn 2 you effectively have 4 mana while most players have 2.',
        '',
        'Example 2 — Mid game:',
        '• Sol Ring lets you cast a draw spell AND hold up interaction in the same turn.',
        '',
        'Example 3 — Late game:',
        '• Helps you chain multiple spells or pay activated abilities during a big “go for it” turn.',
      ].join('\n'),
    },
    {
      id: 'mistakes',
      title: 'Common beginner mistakes',
      premium: true,
      body: [
        '• Playing it too aggressively: dropping Sol Ring early without a plan can paint a target on you.',
        '• Ignoring table politics: some tables unite against the “fast start” player.',
        '• Overvaluing it late: Sol Ring is strongest early — it’s not a win condition by itself.',
      ].join('\n'),
    },
    {
      id: 'politics',
      title: 'Table impact & politics (Commander-only)',
      premium: true,
      body: [
        '• Sol Ring is famous — players track who has it.',
        '• A turn 1 Sol Ring can make you “the threat,” even if your deck is casual.',
        '',
        'Tip:',
        '• At political tables, sometimes it’s correct to delay Sol Ring until you can immediately use the mana for something meaningful.',
      ].join('\n'),
    },
    {
      id: 'synergies',
      title: 'Advanced synergies (Commander)',
      premium: true,
      body: [
        'Sol Ring is especially strong with:',
        '• Big mana decks (expensive commanders and spells)',
        '• Mana sinks (activated abilities and X-spells)',
        '• Card draw engines (extra mana + extra cards = strong turns)',
        '• Artifact synergies (decks that care about artifacts entering or being tapped)',
        '',
        'It fits into almost every Commander deck unless color fixing is your main concern.',
      ].join('\n'),
    },
  ];

  return { snapshot, summary, free, paid };
}

function buildRhysticStudyCommanderSections(): CommanderSplit {
  const snapshot: CommanderSnapshot = {
    role: 'Card advantage / Tax',
    speed: 'Early–Mid',
    complexity: 'Beginner–Intermediate',
    tableImpact: 'High (often draws attention and changes table behavior)',
  };

  const summary =
    'Rhystic Study turns every opponent’s spell into a choice: pay {1} or give you a card — and in Commander, that adds up fast across three opponents.';

  const free: CommanderSection[] = [
    {
      id: 'what',
      title: 'What this card does (plain English)',
      premium: false,
      body: [
        '• Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
        '• If they pay, you do not draw — but their turn is slowed down by 1 mana.',
        '• If they don’t pay, you draw — and over time you get far ahead on cards.',
        '',
        'In simple terms: opponents either slow themselves down or they feed you cards.',
      ].join('\n'),
    },
    {
      id: 'why',
      title: 'Why people play this in Commander (high-level)',
      premium: false,
      body: [
        '• Commander has 3 opponents — so you get far more chances to trigger it.',
        '• Many turns involve multiple spells (ramp, rocks, tutors, removal).',
        '• Even when opponents “pay the 1,” you’ve still taxed their mana and reduced their tempo.',
        '',
        'It’s a classic blue value engine that pressures the table the entire game.',
      ].join('\n'),
    },
  ];

  const paid: CommanderSection[] = [
    {
      id: 'timing',
      title: 'When to play Rhystic Study (timing matters)',
      premium: true,
      body: [
        'Best windows:',
        '• Turn 2–3 is ideal (especially if opponents are still developing and can’t spare mana).',
        '• Right before the table’s “setup turns” (ramp / draw / tutors) makes it harder to pay.',
        '',
        'Be careful:',
        '• If you are already far ahead, slamming it can make you the archenemy.',
        '• If you can protect it (countermagic / bounce), it becomes much stronger.',
        '',
        'Late game:',
        '• Still good — but opponents often have spare mana, so expect more paying.',
      ].join('\n'),
    },
    {
      id: 'examples',
      title: 'Example plays (Commander coaching)',
      premium: true,
      body: [
        'Example 1 — Turn 3 Rhystic + hold up interaction:',
        '• You play Rhystic Study and keep 1–2 mana open.',
        '• Opponents are pressured: if they tap out, you draw; if they pay, their turn is slower; if they try to remove it, you can respond.',
        '',
        'Example 2 — After a board wipe:',
        '• You drop Rhystic when the board is reset.',
        '• Everyone tries to rebuild with multiple spells — you either draw a lot or they lose tempo.',
        '',
        'Example 3 — Versus the “big turn” player:',
        '• When a spellslinger or storm-style deck tries to chain spells, Rhystic forces extra payments or gives you a huge hand to fight back.',
      ].join('\n'),
    },
    {
      id: 'mistakes',
      title: 'Common beginner mistakes',
      premium: true,
      body: [
        '• Missing triggers: you must notice each opponent spell and resolve the choice.',
        '• Slowing the game too much: be consistent and quick with “Rhystic trigger — pay {1}?”',
        '• Casting it with zero protection when the table is clearly holding removal.',
        '• Getting emotional if people start paying — the tax is still valuable.',
        '• Forgetting that it triggers on “boring” spells too (mana rocks, ramp, tutors, removal).',
      ].join('\n'),
    },
    {
      id: 'politics',
      title: 'Table impact & politics (Commander-only)',
      premium: true,
      body: [
        'Rhystic Study changes table behavior immediately.',
        '',
        'How to pilot it cleanly:',
        '• Keep your tone neutral: “Rhystic trigger — pay {1}?”',
        '• Don’t shame or argue — that makes you the target.',
        '• If one player is popping off, remind the table that paying matters *for that player’s turn*.',
        '',
        'Reality:',
        '• You will draw attention. Sometimes that’s fine because Rhystic keeps your hand full to defend yourself.',
      ].join('\n'),
    },
    {
      id: 'synergies',
      title: 'Advanced synergies (Commander)',
      premium: true,
      body: [
        'Rhystic Study is especially strong with:',
        '• Instant-speed interaction (holding mana up makes paying {1} much harder)',
        '• Additional tax effects (anything that squeezes mana makes “pay {1}” painful)',
        '• Wheel / refill turns (opponents rebuilding often cast multiple spells)',
        '• Protection and recursion (if your deck can protect or replay enchantments)',
        '',
        'Concept:',
        '• Rhystic doesn’t need combos — it just turns time into cards. The longer it survives, the more it dominates.',
      ].join('\n'),
    },
  ];

  return { snapshot, summary, free, paid };
}

function buildSmotheringTitheCommanderSections(): CommanderSplit {
  const snapshot: CommanderSnapshot = {
    role: 'Ramp / Treasure engine',
    speed: 'Mid',
    complexity: 'Beginner–Intermediate',
    tableImpact: 'High (forces table to pay or give you Treasures)',
  };

  const summary =
    'Smothering Tithe turns every opponent draw into a choice: pay {2} or give you a Treasure — and in Commander, that usually means a flood of mana over time.';

  const free: CommanderSection[] = [
    {
      id: 'what',
      title: 'What this card does (plain English)',
      premium: false,
      body: [
        '• Whenever an opponent draws a card, that player may pay {2}.',
        '• If they don’t pay, you create a Treasure token.',
        '• Treasures can be sacrificed to add one mana of any color.',
        '',
        'In simple terms: opponents either spend extra mana or they give you extra mana.',
      ].join('\n'),
    },
    {
      id: 'why',
      title: 'Why people play this in Commander (high-level)',
      premium: false,
      body: [
        '• Commander has 3 opponents, so there are a lot of draw steps and draw spells.',
        '• Most players can’t afford to pay {2} repeatedly all game.',
        '• Treasures fix your colors and let you take big turns earlier.',
        '',
        'If it survives for even a couple turns, it often pays for itself and then some.',
      ].join('\n'),
    },
  ];

  const paid: CommanderSection[] = [
    {
      id: 'timing',
      title: 'When to play Smothering Tithe (timing matters)',
      premium: true,
      body: [
        'Best windows:',
        '• When opponents are about to start drawing extra cards (Rhystic Study, wheel effects, big draw spells).',
        '• Right before your own “big turn” so you can stockpile Treasures for a huge sequence.',
        '',
        'Be careful:',
        '• If you cast it into open mana and the table is holding removal, it may die before it produces value.',
        '• If you are already ahead, this can instantly make you the archenemy.',
        '',
        'Late game:',
        '• Still strong because it turns draw-heavy turns into a burst of Treasures.',
      ].join('\n'),
    },
    {
      id: 'examples',
      title: 'Example plays (Commander coaching)',
      premium: true,
      body: [
        'Example 1 — “One turn cycle” value:',
        '• You play Smothering Tithe and pass.',
        '• Over the next three draw steps alone, opponents likely can’t pay {2} each time → you get multiple Treasures immediately.',
        '',
        'Example 2 — Wheel punisher:',
        '• An opponent casts a wheel (everyone discards and draws 7).',
        '• Smothering Tithe triggers for each opponent draw → you can make a huge pile of Treasures and often win on the spot if you’re set up.',
        '',
        'Example 3 — Convert Treasures into safety:',
        '• Use Treasures to keep interaction mana up (removal/counters) while still developing your board.',
      ].join('\n'),
    },
    {
      id: 'mistakes',
      title: 'Common beginner mistakes',
      premium: true,
      body: [
        '• Waiting too long: Tithe is best before draw-heavy turns, not after.',
        '• Not tracking triggers: it triggers on every draw by opponents (including extra draws).',
        '• Hoarding Treasures forever: convert them into advantage before someone removes Tithe or wipes artifacts.',
        '• Spending Treasures mindlessly: sometimes the best use is holding up interaction, not casting random stuff.',
        '• Forgetting you can make any color: use Treasures to fix awkward mana.',
      ].join('\n'),
    },
    {
      id: 'politics',
      title: 'Table impact & politics (Commander-only)',
      premium: true,
      body: [
        'Smothering Tithe can change the “social” balance of the table.',
        '',
        'How to pilot it cleanly:',
        '• Don’t argue about payments — ask neutrally: “Pay {2}?”',
        '• Be fast and consistent so you don’t slow the game down.',
        '• If one player is clearly ahead, you can frame Tithe as a way to keep up — but expect people to still remove it.',
        '',
        'Reality:',
        '• Many tables treat Tithe as a must-kill card. Plan for that.',
      ].join('\n'),
    },
    {
      id: 'synergies',
      title: 'Advanced synergies (Commander)',
      premium: true,
      body: [
        'Smothering Tithe is especially strong with:',
        '• Wheel effects and mass draw (lots of triggers at once)',
        '• Any card that makes opponents draw extra cards',
        '• Artifact payoffs (cards that care about artifacts entering the battlefield)',
        '• Big mana payoffs and X-spells (Treasures fuel huge turns)',
        '• Sacrifice synergies (Treasures are artifacts you can sacrifice for value)',
        '',
        'Concept:',
        '• Tithe turns “time + opponent draws” into mana. The more draw in your meta, the more oppressive it becomes.',
      ].join('\n'),
    },
  ];

  return { snapshot, summary, free, paid };
}

/**
 * =========================
 * Commander Split Registry
 * =========================
 */
const COMMANDER_SPLIT_BUILDERS: Record<string, () => CommanderSplit> = {
  [normalizeName('Sol Ring')]: buildSolRingCommanderSections,
  [normalizeName('Rhystic Study')]: buildRhysticStudyCommanderSections,
  [normalizeName('Smothering Tithe')]: buildSmotheringTitheCommanderSections,
};

function getCommanderSplitForCardName(name: string): CommanderSplit | null {
  const key = normalizeName(name);
  const builder = COMMANDER_SPLIT_BUILDERS[key];
  return builder ? builder() : null;
}

function isCommanderSplitCard(name: string): boolean {
  return Boolean(COMMANDER_SPLIT_BUILDERS[normalizeName(name)]);
}

/**
 * =========================
 * Page
 * =========================
 */
export default function Page() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedName, setSelectedName] = useState<string>('');
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  const [activeTab, setActiveTab] = useState<'explain' | 'synergies' | 'glossary'>('explain');

  const [explanation, setExplanation] = useState<string>('');
  const [synergies, setSynergies] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Tooltip state
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  // "Premium preview" is local only (no billing). Used to test UX/value gap.
  const [premiumPreview, setPremiumPreview] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown/tooltips on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setShowDropdown(false);
      }

      if (pinnedKey) {
        setPinnedKey(null);
      }
      setHoverKey(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [pinnedKey]);

  // Debounced suggestions
  useEffect(() => {
    let alive = true;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsSuggesting(true);

        const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`);
        const data = (await safeJson(res)) as any;
        const names: string[] = Array.isArray(data?.data) ? data.data.slice(0, 10) : [];

        const quick: Suggestion[] = names.map((name) => ({
          id: `name:${name}`,
          name,
          image: null,
          type_line: '',
          mana_cost: '',
        }));
        if (alive) {
          setSuggestions(quick);
          setShowDropdown(true);
        }

        const enriched = await Promise.all(
          names.map(async (name) => {
            try {
              const r = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
              const c = (await safeJson(r)) as ScryfallCard | null;
              return {
                id: c?.id ?? `name:${name}`,
                name,
                image: c ? getBestCardImage(c) : null,
                type_line: c ? getTypeLine(c) : '',
                mana_cost: c ? getManaCost(c) : '',
              } as Suggestion;
            } catch {
              return { id: `name:${name}`, name, image: null, type_line: '', mana_cost: '' } as Suggestion;
            }
          })
        );

        if (alive) setSuggestions(enriched);
      } finally {
        if (alive) setIsSuggesting(false);
      }
    }, 160);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  async function fetchCardByName(name: string) {
    const clean = name.trim();
    if (!clean) return;

    setSelectedName(clean);
    setIsLoadingCard(true);
    setAiError(null);
    setActiveTab('explain');

    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(clean)}`);
      const data = (await safeJson(res)) as ScryfallCard | null;
      if (!data || (data as any).object === 'error') {
        setCard(null);
        setExplanation('Could not find that card on Scryfall. Try a different name.');
        setSynergies('');
        return;
      }

      setCard(data);

      const manual = MANUAL_EXPLAINERS[data.name];
      if (manual) {
        if (!isCommanderSplitCard(data.name)) {
          const manualText = [
            `Manual Explainer: ${manual.title}`,
            '',
            manual.short,
            '',
            `Why people play it (Commander):`,
            ...manual.why.map((w) => `• ${w}`),
            '',
            `Quick tips:`,
            ...manual.tips.map((t) => `• ${t}`),
            ...(manual.gotchas?.length ? ['', `Gotchas:`, ...manual.gotchas.map((g) => `• ${g}`)] : []),
          ].join('\n');
          setExplanation(manualText);
        } else {
          setExplanation('');
        }
      } else {
        setExplanation(buildStandardExplanation(data));
      }

      setSynergies(buildStandardSynergies(data));
    } catch {
      setCard(null);
      setExplanation('Error fetching card. Please try again.');
      setSynergies('');
    } finally {
      setIsLoadingCard(false);
      setShowDropdown(false);
    }
  }

  async function callAI(mode: 'explain' | 'synergies') {
    if (!card) return;
    setAiError(null);
    setAiLoading(true);

    try {
      const body = {
        mode,
        card: {
          name: card.name,
          mana_cost: getManaCost(card),
          type_line: getTypeLine(card),
          oracle_text: getOracleText(card),
          tags: buildContextTags(card),
        },
      };

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const msg = data?.error || `AI error (${res.status}).`;
        setAiError(String(msg));
        return;
      }

      const out = data?.text || data?.explanation || data?.result || '';
      if (!out || typeof out !== 'string') {
        setAiError('AI returned an empty response.');
        return;
      }

      if (mode === 'explain') setExplanation(out);
      if (mode === 'synergies') setSynergies(out);
    } catch (e: any) {
      setAiError('AI request failed. Check your API route + env vars.');
    } finally {
      setAiLoading(false);
    }
  }

  const selectedImage = useMemo(() => getBestCardImage(card), [card]);
  const oracleText = useMemo(() => getOracleText(card), [card]);
  const typeLine = useMemo(() => getTypeLine(card), [card]);
  const manaCost = useMemo(() => getManaCost(card), [card]);
  const tags = useMemo(() => buildContextTags(card), [card]);

  const commanderSplit = useMemo(() => (card ? getCommanderSplitForCardName(card.name) : null), [card]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Explain My Card</h1>
          <p className="text-zinc-400">
            Commander-first explanations: what the card does, when to play it, and how it synergizes — in plain English.
          </p>
        </div>

        {/* Search */}
        <div ref={searchBoxRef} className="relative mb-6">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search a card… (e.g., Sol Ring)"
              className={cx(
                'w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100',
                'placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600'
              )}
            />
            <button
              onClick={() => fetchCardByName(query)}
              className={cx(
                'rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold',
                'hover:bg-zinc-800/60 focus:outline-none focus:ring-2 focus:ring-zinc-600'
              )}
            >
              Explain
            </button>
          </div>

          {/* Dropdown */}
          {showDropdown && (suggestions.length > 0 || isSuggesting) && (
            <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              {isSuggesting && suggestions.length === 0 && (
                <div className="px-4 py-3 text-sm text-zinc-400">Searching…</div>
              )}

              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className={cx(
                    'flex w-full items-center gap-3 px-4 py-3 text-left',
                    'hover:bg-zinc-900 focus:outline-none focus:bg-zinc-900'
                  )}
                  onClick={() => {
                    setQuery(s.name);
                    fetchCardByName(s.name);
                  }}
                >
                  <div className="h-10 w-8 overflow-hidden rounded bg-zinc-900">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.name}</div>
                    <div className="truncate text-xs text-zinc-400">{s.type_line || '—'}</div>
                  </div>
                  <div className="text-xs text-zinc-400">{s.mana_cost || ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Card */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{card ? card.name : 'No card selected'}</div>
                  <div className="text-sm text-zinc-400">{card ? typeLine : 'Search a card to begin.'}</div>
                  {card && (
                    <div className="mt-1 text-xs text-zinc-500">
                      {manaCost ? `Mana: ${manaCost}` : ''} {card.cmc != null ? ` • MV: ${card.cmc}` : ''}
                      {card.set_name ? ` • Set: ${card.set_name}` : ''}
                    </div>
                  )}
                </div>
                {card && (
                  <button
                    onClick={() => setPremiumPreview((v) => !v)}
                    className={cx(
                      'rounded-xl border px-3 py-2 text-xs font-semibold',
                      premiumPreview
                        ? 'border-emerald-700 bg-emerald-950 text-emerald-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800/60'
                    )}
                    title="Local preview only. No billing."
                  >
                    {premiumPreview ? 'Premium Preview: ON' : 'Premium Preview'}
                  </button>
                )}
              </div>

              {isLoadingCard ? (
                <div className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-300">Loading card…</div>
              ) : card ? (
                <>
                  {selectedImage ? (
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedImage} alt={card.name} className="w-full" />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
                      No image available.
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold text-zinc-400">Oracle text</div>
                    <pre className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-200">
                      {oracleText || '—'}
                    </pre>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold text-zinc-400">Detected tags</div>
                    <div className="flex flex-wrap gap-2">
                      {tags.length ? (
                        tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Type a card name above to get started.
                </div>
              )}
            </div>
          </div>

          {/* Right: Tabs + Content */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg">
              {/* Tabs */}
              <div className="mb-4 flex flex-wrap gap-2">
                {(['explain', 'synergies', 'glossary'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={cx(
                      'rounded-xl border px-4 py-2 text-sm font-semibold',
                      activeTab === t
                        ? 'border-zinc-600 bg-zinc-900 text-zinc-100'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
                    )}
                  >
                    {t === 'explain' ? 'Explain' : t === 'synergies' ? 'Synergies' : 'Glossary'}
                  </button>
                ))}
              </div>

              {/* Explain Tab */}
              {activeTab === 'explain' && (
                <div className="space-y-4">
                  {!card ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                      Search for a card to see an explanation.
                    </div>
                  ) : commanderSplit ? (
                    <>
                      {/* Snapshot */}
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <div className="mb-2 text-sm font-semibold text-zinc-200">Commander Snapshot (Free)</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200">
                            Role: {commanderSplit.snapshot.role}
                          </span>
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200">
                            Speed: {commanderSplit.snapshot.speed}
                          </span>
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200">
                            Complexity: {commanderSplit.snapshot.complexity}
                          </span>
                          {commanderSplit.snapshot.tableImpact && (
                            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-200">
                              Table Impact: {commanderSplit.snapshot.tableImpact}
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 text-sm font-semibold text-zinc-200">One-sentence summary (Free)</div>
                          <p className="text-sm leading-relaxed text-zinc-200">{commanderSplit.summary}</p>
                        </div>
                      </div>

                      {/* Free sections */}
                      {commanderSplit.free.map((sec) => (
                        <div key={sec.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-200">{sec.title}</div>
                            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">
                              Free
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                            {renderTextWithTooltips(sec.body, hoverKey, setHoverKey, pinnedKey, setPinnedKey)}
                          </pre>
                        </div>
                      ))}

                      {/* Paid sections */}
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-zinc-200">Commander Coaching (Locked)</div>
                          <span className="rounded-full border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-200">
                            Premium
                          </span>
                        </div>

                        <div className="mb-3 text-sm text-zinc-400">
                          These sections teach <span className="text-zinc-200">timing, examples, mistakes, politics</span>, and advanced synergy — the
                          “how to play it correctly” part.
                        </div>

                        {!premiumPreview ? (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                            <div className="text-sm font-semibold text-zinc-200">Locked</div>
                            <div className="mt-1 text-sm text-zinc-400">
                              Turn on <span className="text-zinc-200">Premium Preview</span> (button on the left card panel) to see how paid content will look.
                            </div>
                            <div className="mt-3 text-xs text-zinc-500">This is a free local preview. No billing.</div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {commanderSplit.paid.map((sec) => (
                              <div key={sec.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                <div className="mb-2 text-sm font-semibold text-zinc-200">{sec.title}</div>
                                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                                  {renderTextWithTooltips(sec.body, hoverKey, setHoverKey, pinnedKey, setPinnedKey)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-zinc-200">Explanation</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => callAI('explain')}
                            disabled={aiLoading}
                            className={cx(
                              'rounded-xl border px-3 py-2 text-xs font-semibold',
                              'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800/60',
                              aiLoading && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            Improve with AI
                          </button>
                        </div>
                      </div>

                      {aiError && (
                        <div className="mb-3 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
                          {aiError}
                        </div>
                      )}

                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                        {renderTextWithTooltips(explanation || '—', hoverKey, setHoverKey, pinnedKey, setPinnedKey)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Synergies Tab */}
              {activeTab === 'synergies' && (
                <div className="space-y-4">
                  {!card ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                      Search for a card to see synergies.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-zinc-200">Synergies (Commander)</div>
                        <button
                          onClick={() => callAI('synergies')}
                          disabled={aiLoading}
                          className={cx(
                            'rounded-xl border px-3 py-2 text-xs font-semibold',
                            'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800/60',
                            aiLoading && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          Improve with AI
                        </button>
                      </div>

                      {aiError && (
                        <div className="mb-3 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
                          {aiError}
                        </div>
                      )}

                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                        {renderTextWithTooltips(synergies || '—', hoverKey, setHoverKey, pinnedKey, setPinnedKey)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Glossary Tab */}
              {activeTab === 'glossary' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-2 text-sm font-semibold text-zinc-200">Commander Glossary (Acronyms + Concepts)</div>
                    <div className="space-y-3">
                      {GLOSSARY.map((g) => (
                        <div key={g.term} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-zinc-100">{g.term}</div>
                            <div className="flex flex-wrap gap-2">
                              {g.tags?.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-zinc-200">{g.meaning}</div>
                          {g.details && <div className="mt-1 text-xs text-zinc-400">{g.details}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-2 text-sm font-semibold text-zinc-200">Common Keyword Abilities (Hover or click in explanations)</div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {Object.keys(KEYWORD_DEFINITIONS)
                        .sort((a, b) => a.localeCompare(b))
                        .map((k) => (
                          <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                            <div className="text-sm font-semibold text-zinc-100">{k}</div>
                            <div className="mt-1 text-xs text-zinc-300">{KEYWORD_DEFINITIONS[k]}</div>
                          </div>
                        ))}
                    </div>
                    <div className="mt-3 text-xs text-zinc-500">
                      Tip: In the Explain/Synergies tabs, hover a highlighted keyword to preview its meaning, or click to pin it open.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer helper */}
            <div className="mt-4 text-xs text-zinc-500">
              Manual explainers are used when available. Otherwise, the site uses a deterministic free explanation, with optional AI improvement if your API is configured.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}