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

          <span
            className={cx(
              'pointer-events-none absolute left-0 top-full z-50 mt-2 w-[min(320px,80vw)]',
              'rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow-xl',
              'transition-opacity',
              isOpen ? 'opacity-100' : 'opacity-0'
            )}
            role="tooltip"
          >
            <span className="block text-zinc-100">{definition}</span>
            <span className="mt-1 block text-[11px] text-zinc-400">Tip: click anywhere to close.</span>
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
 * =========================
 */
type GlossaryItem = {
  term: string;
  meaning: string;
  details?: string;
  tags?: string[];
};

const GLOSSARY: GlossaryItem[] = [
  {
    term: 'ETB',
    meaning: 'Enters the Battlefield',
    details: 'Triggered abilities that happen when a permanent enters the battlefield.',
    tags: ['trigger', 'battlefield'],
  },
  {
    term: 'LTB',
    meaning: 'Leaves the Battlefield',
    details: 'Triggered abilities that happen when a permanent leaves the battlefield (dies, exiled, bounced, etc.).',
    tags: ['trigger', 'battlefield'],
  },
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
    patterns.push('• Hold it for the most dangerous threat, not the first creature you see.');
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
    patterns.push('• Make tokens, then use them to attack, block, or fuel other effects.');
    tips.push('• Token decks usually want ways to buff tokens or convert them into value.');
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

  if (o.includes('target')) gotchas.push('• This card targets. If the target becomes illegal, the effect may fail.');
  if (o.includes('exile')) gotchas.push('• Exile is different from destroy: it usually prevents most death triggers and recursion.');
  if (o.includes('until end of turn')) gotchas.push('• “Until end of turn” effects wear off during the cleanup step at the end of the turn.');
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
  if (tags.includes('instant') || tags.includes('sorcery') || tags.includes('cast-triggers')) themes.push('• Spellslinger (many instants/sorceries)');
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

  infin.push('• No specific infinite combo is suggested in free mode.');
  infin.push('• If you enable AI later, the app can suggest more detailed combo patterns.');

  if (oracle.includes('exile your graveyard') || oracle.includes('exile all cards from your graveyard')) {
    avoid.push('• This can conflict with heavy graveyard strategies (you may remove your own resources).');
  }
  if (typeLine.includes('aura')) {
    avoid.push('• Aura plans can be fragile if opponents have lots of instant-speed removal.');
  }
  if (tags.includes('mana') && oracle.includes('colorless')) {
    avoid.push('• If your deck needs a lot of colored mana, pair this with good color fixing.');
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

const MANUAL_KEYS = new Set(Object.keys(MANUAL_EXPLAINERS).map((k) => k.toLowerCase().trim()));

export default function Page() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedName, setSelectedName] = useState<string>('');
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  const [activeTab, setActiveTab] = useState<'explain' | 'synergies' | 'glossary'>('explain');

  const [standardExplanation, setStandardExplanation] = useState<string>('');
  const [standardSynergies, setStandardSynergies] = useState<string>('');
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiSynergies, setAiSynergies] = useState<string>('');

  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [isLoadingSynergy, setIsLoadingSynergy] = useState(false);

  const [notice, setNotice] = useState<string>('');

  const [preferManualFirst, setPreferManualFirst] = useState(true);
  const [autoFetchAI, setAutoFetchAI] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null);

  const [glossaryQuery, setGlossaryQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const manual = useMemo(() => {
    const key = normalizeName(selectedName || query);
    for (const name of Object.keys(MANUAL_EXPLAINERS)) {
      if (normalizeName(name) === key) return MANUAL_EXPLAINERS[name];
    }
    return null;
  }, [selectedName, query]);

  const manualMatchIsExact = useMemo(() => {
    if (!selectedName) return false;
    return MANUAL_KEYS.has(normalizeName(selectedName));
  }, [selectedName]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setShowDropdown(false);
      setOpenTooltipKey(null);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSuggesting(true);
    const handle = setTimeout(async () => {
      try {
        const acRes = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`);
        const acJson = await safeJson(acRes);
        const names: string[] = Array.isArray(acJson?.data) ? acJson.data.slice(0, 8) : [];

        const cards: Suggestion[] = [];
        for (const name of names) {
          try {
            const namedRes = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
            const namedJson = (await safeJson(namedRes)) as ScryfallCard | null;

            cards.push({
              id: namedJson?.id || name,
              name,
              image: namedJson ? getBestCardImage(namedJson) : null,
              type_line: namedJson?.type_line || '',
              mana_cost: namedJson?.mana_cost || '',
            });
          } catch {
            cards.push({ id: name, name, image: null });
          }
        }

        setSuggestions(cards);
        setShowDropdown(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSuggesting(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  async function loadCardByName(name: string) {
    const n = name.trim();
    if (!n) return;

    setNotice('');
    setOpenTooltipKey(null);
    setIsLoadingCard(true);
    setCard(null);

    setStandardExplanation('');
    setStandardSynergies('');
    setAiExplanation('');
    setAiSynergies('');
    setActiveTab('explain');

    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(n)}`);
      const json = (await safeJson(res)) as ScryfallCard | null;

      if (!res.ok || !json?.name) {
        setNotice('Could not find that card on Scryfall. Check spelling and try again.');
        setCard(null);
        return;
      }

      setCard(json);
      setStandardExplanation(buildStandardExplanation(json));
      setStandardSynergies(buildStandardSynergies(json));
    } catch {
      setNotice('Network error while loading card data. Please try again.');
      setCard(null);
    } finally {
      setIsLoadingCard(false);
    }
  }

  function onPickSuggestion(name: string) {
    setSelectedName(name);
    setQuery(name);
    setShowDropdown(false);
    loadCardByName(name);
  }

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = query.trim();
    if (!n) return;
    setSelectedName(n);
    setShowDropdown(false);
    await loadCardByName(n);
  }

  async function fetchAI(mode: 'explain' | 'synergies') {
    if (!card) return;

    if (!aiEnabled) {
      setNotice('AI is turned off (free mode). You are seeing the standard explanation.');
      return;
    }

    const payload = {
      mode,
      card: {
        name: card.name,
        mana_cost: getManaCost(card),
        type_line: getTypeLine(card),
        oracle_text: getOracleText(card),
        keywords: card.keywords || [],
        colors: card.colors || [],
        color_identity: card.color_identity || [],
        produced_mana: card.produced_mana || [],
        cmc: card.cmc ?? null,
        rarity: card.rarity ?? null,
        set: card.set ?? null,
        set_name: card.set_name ?? null,
        tags: buildContextTags(card),
      },
      prefs: {
        audience: 'beginner',
        format: 'bulleted-with-sections',
        concise: false,
        commanderFocus: true,
      },
    };

    if (mode === 'explain') setIsLoadingExplain(true);
    else setIsLoadingSynergy(true);

    setNotice('');

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(res);

      if (!res.ok) {
        const status = res.status;

        if (status === 401) setNotice('AI is unavailable (invalid API key). Showing standard explanation instead.');
        else if (status === 429) setNotice('AI is unavailable (quota/billing). This app can run free using the standard explanation.');
        else setNotice('AI is unavailable right now. Showing standard explanation.');

        return;
      }

      const text =
        mode === 'explain'
          ? (json?.explanation as string) || (json?.text as string) || ''
          : (json?.synergies as string) || (json?.explanation as string) || (json?.text as string) || '';

      if (!text) {
        setNotice('AI returned an empty response. Showing standard explanation.');
        return;
      }

      if (mode === 'explain') setAiExplanation(text);
      else setAiSynergies(text);
    } catch {
      setNotice('Network error calling AI. Showing standard explanation.');
    } finally {
      if (mode === 'explain') setIsLoadingExplain(false);
      else setIsLoadingSynergy(false);
    }
  }

  useEffect(() => {
    if (!card) return;
    if (!aiEnabled) return;
    if (!autoFetchAI) return;
    fetchAI('explain');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, aiEnabled, autoFetchAI]);

  const cardImage = useMemo(() => getBestCardImage(card), [card]);
  const oracleText = useMemo(() => getOracleText(card), [card]);

  const showManual = Boolean(card && manual && (preferManualFirst || manualMatchIsExact));

  const explainToShow = aiExplanation || standardExplanation;
  const synergiesToShow = aiSynergies || standardSynergies;

  const filteredGlossary = useMemo(() => {
    const q = glossaryQuery.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter((g) => {
      const hay = `${g.term} ${g.meaning} ${g.details ?? ''} ${(g.tags ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [glossaryQuery]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Explain My Card</h1>
            <p className="text-sm text-zinc-400">Search any Magic card. Get a clear explanation + beginner-friendly synergies.</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <input type="checkbox" className="accent-zinc-200" checked={preferManualFirst} onChange={(e) => setPreferManualFirst(e.target.checked)} />
              Prefer manual explainer first
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <input
                type="checkbox"
                className="accent-zinc-200"
                checked={aiEnabled}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAiEnabled(next);
                  if (!next) setNotice('AI turned off. Using standard explanation (free mode).');
                  else setNotice('AI turned on. If billing/quota is not enabled, it will fall back to free mode.');
                }}
              />
              Enable AI (optional)
            </label>

            <label
              className={cx(
                'flex items-center gap-2 rounded-lg border px-3 py-2',
                aiEnabled ? 'border-zinc-800 bg-zinc-900/40 text-zinc-300' : 'border-zinc-900 bg-zinc-950 text-zinc-600'
              )}
            >
              <input type="checkbox" className="accent-zinc-200" checked={autoFetchAI} onChange={(e) => setAutoFetchAI(e.target.checked)} disabled={!aiEnabled} />
              Auto-fetch AI
            </label>
          </div>
        </div>

        <div className="mt-6" ref={dropdownRef}>
          <form onSubmit={onSearchSubmit} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (suggestions.length) setShowDropdown(true);
                  }}
                  placeholder="Type a card name… (e.g., Sol Ring, Rhystic Study, Lightning Greaves)"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-sm outline-none focus:border-zinc-600"
                />

                {showDropdown && (suggestions.length > 0 || isSuggesting) && (
                  <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
                    {isSuggesting && <div className="px-4 py-3 text-sm text-zinc-400">Searching…</div>}

                    {!isSuggesting &&
                      suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onPickSuggestion(s.name)}
                          className="flex w-full items-center gap-3 border-b border-zinc-800 px-4 py-3 text-left hover:bg-zinc-800/50"
                        >
                          <div className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-800">
                            {s.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">—</div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-zinc-100">{s.name}</div>
                            <div className="truncate text-xs text-zinc-400">
                              {s.mana_cost ? `${s.mana_cost} · ` : ''}
                              {s.type_line || 'Card'}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <button type="submit" className="rounded-xl border border-zinc-800 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white">
                Search
              </button>
            </div>
          </form>

          <div className="mt-2 text-xs text-zinc-500">Tip: keywords like “trample” or “exile” are clickable.</div>
        </div>

        {notice ? <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-200">{notice}</div> : null}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="text-sm font-semibold text-zinc-200">Card</div>

            <div className="mt-3">
              {isLoadingCard ? (
                <div className="space-y-3">
                  <div className="h-6 w-2/3 rounded bg-zinc-800" />
                  <div className="h-48 w-full rounded-xl bg-zinc-800" />
                  <div className="h-4 w-full rounded bg-zinc-800" />
                  <div className="h-4 w-5/6 rounded bg-zinc-800" />
                </div>
              ) : card ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold">{card.name}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {getManaCost(card) ? <span className="mr-2">{getManaCost(card)}</span> : null}
                      {getTypeLine(card)}
                    </div>
                  </div>

                  {cardImage ? (
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cardImage} alt={card.name} className="h-auto w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
                      No image available
                    </div>
                  )}

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs font-semibold text-zinc-300">Oracle text</div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-zinc-200" onClick={() => setOpenTooltipKey(null)}>
                      {renderTextWithTooltips(oracleText || 'No oracle text found.', openTooltipKey, setOpenTooltipKey)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Search for a card to see it here.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Explanation</div>
                <div className="text-xs text-zinc-500">Manual for staples + standard (free) for everything + optional AI enhancement.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('explain')}
                  className={cx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold',
                    activeTab === 'explain'
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900'
                  )}
                >
                  Explain
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('synergies')}
                  className={cx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold',
                    activeTab === 'synergies'
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900'
                  )}
                  disabled={!card}
                  title={!card ? 'Search a card first' : 'Show synergies'}
                >
                  Synergies
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('glossary')}
                  className={cx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold',
                    activeTab === 'glossary'
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900'
                  )}
                >
                  Glossary
                </button>

                <button
                  type="button"
                  onClick={() => fetchAI('explain')}
                  disabled={!card || isLoadingExplain}
                  className={cx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold',
                    !card || isLoadingExplain
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-500'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900'
                  )}
                  title={!card ? 'Search a card first' : 'Try AI (optional)'}
                >
                  {isLoadingExplain ? 'Trying…' : 'Try AI'}
                </button>
              </div>
            </div>

            {showManual ? (
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">Manual explainer</div>
                    <div className="mt-1 text-xs text-zinc-500">{manual!.title}</div>
                  </div>
                  <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                    Staples library
                  </div>
                </div>

                <div className="mt-3 text-sm text-zinc-200">{manual!.short}</div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-xs font-semibold text-zinc-200">Why people play it</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                      {manual!.why.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-xs font-semibold text-zinc-200">Tips</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                      {manual!.tips.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {manual!.gotchas?.length ? (
                  <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-xs font-semibold text-zinc-200">Gotchas</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                      {manual!.gotchas.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {activeTab === 'explain' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4" onClick={() => setOpenTooltipKey(null)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{aiExplanation ? 'AI-enhanced explanation' : 'Standard explanation (free)'}</div>
                      <div className="text-xs text-zinc-500">{aiExplanation ? 'Generated by AI (when available).' : 'Generated locally from oracle text + simple rules.'}</div>
                    </div>

                    <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                      {aiExplanation ? 'AI on' : 'Free mode'}
                    </div>
                  </div>

                  {!card ? (
                    <div className="mt-3 text-sm text-zinc-400">Search a card to generate an explanation.</div>
                  ) : (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {renderTextWithTooltips(explainToShow || 'No explanation available yet.', openTooltipKey, setOpenTooltipKey)}
                    </pre>
                  )}
                </div>
              )}

              {activeTab === 'synergies' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4" onClick={() => setOpenTooltipKey(null)}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{aiSynergies ? 'AI-enhanced synergies' : 'Standard synergies (free)'}</div>
                      <div className="text-xs text-zinc-500">{aiSynergies ? 'Generated by AI (when available).' : 'Generated locally from oracle text + simple rules.'}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchAI('synergies')}
                      disabled={!card || isLoadingSynergy}
                      className={cx(
                        'rounded-xl border px-3 py-2 text-xs font-semibold',
                        !card || isLoadingSynergy
                          ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800/60'
                      )}
                    >
                      {isLoadingSynergy ? 'Trying…' : 'Try AI synergies'}
                    </button>
                  </div>

                  {!card ? (
                    <div className="mt-3 text-sm text-zinc-400">Search a card first.</div>
                  ) : (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {renderTextWithTooltips(synergiesToShow || 'No synergies available yet.', openTooltipKey, setOpenTooltipKey)}
                    </pre>
                  )}
                </div>
              )}

              {activeTab === 'glossary' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Glossary</div>
                      <div className="text-xs text-zinc-500">Common Magic acronyms, abbreviations, and shorthand.</div>
                    </div>

                    <div className="w-full sm:w-72">
                      <input
                        value={glossaryQuery}
                        onChange={(e) => setGlossaryQuery(e.target.value)}
                        placeholder="Search glossary… (e.g., ETB, MV, ramp)"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-600"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {filteredGlossary.length === 0 ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">No matches. Try a different search.</div>
                    ) : (
                      filteredGlossary.map((g) => (
                        <div key={g.term} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="text-sm font-semibold text-zinc-100">{g.term}</div>
                            <div className="text-xs text-zinc-300">{g.meaning}</div>
                          </div>
                          {g.details ? <div className="mt-2 text-sm text-zinc-200">{g.details}</div> : null}
                          {g.tags?.length ? <div className="mt-2 text-xs text-zinc-500">Tags: {g.tags.join(', ')}</div> : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
              Tip: Keyword tooltips are for rule words (trample/ward/exile). Glossary is for shorthand (ETB/MV/ramp).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}