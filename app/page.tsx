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

function compactArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function buildContextTags(card: ScryfallCard | null): string[] {
  if (!card) return [];
  const t = getTypeLine(card).toLowerCase();
  const o = getOracleText(card).toLowerCase();

  const tags: string[] = [];

  // Type-ish tags
  if (t.includes('legendary') && t.includes('creature')) tags.push('legendary-creature');
  if (t.includes('planeswalker')) tags.push('planeswalker');
  if (t.includes('artifact')) tags.push('artifact');
  if (t.includes('enchantment')) tags.push('enchantment');
  if (t.includes('instant')) tags.push('instant');
  if (t.includes('sorcery')) tags.push('sorcery');
  if (t.includes('land')) tags.push('land');

  // Effect-ish tags (very simple heuristics)
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
 * FREE, deterministic "Standard explanation" fallback.
 * Goal: clear, beginner-friendly, Commander-leaning, no hallucinations.
 */
function buildStandardExplanation(card: ScryfallCard): string {
  const name = card.name;
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

  // ---- WHAT IT DOES (simple reads from tags/text)
  if (tags.includes('mana') || tl.includes('artifact') && o.includes('{t}: add')) {
    what.push('• Helps you produce mana, so you can cast spells sooner.');
  }
  if (tags.includes('card-draw')) {
    what.push('• Helps you draw extra cards (more options each turn).');
  }
  if (tags.includes('removal')) {
    what.push('• Removes or answers a threat (often by destroying or exiling).');
  }
  if (tags.includes('tokens')) {
    what.push('• Creates creature tokens or other tokens, which can build a board quickly.');
  }
  if (tags.includes('countermagic')) {
    what.push('• Can stop an opponent’s spell by countering it (it does not resolve).');
  }
  if (tags.includes('graveyard')) {
    what.push('• Interacts with the graveyard (yours or opponents’).');
  }
  if (tags.includes('tutor-or-search')) {
    what.push('• Lets you search your library for a card or land (increases consistency).');
  }
  if (tl.includes('creature') && (card.power || card.toughness)) {
    what.push(`• It is a creature (${card.power ?? '?'} / ${card.toughness ?? '?'}). It can attack and block.`);
  }
  if (tl.includes('planeswalker')) {
    what.push('• It is a planeswalker. You activate one loyalty ability per turn (on your turn).');
  }

  // If we didn’t find anything, fall back to a literal description.
  if (what.length === 0) {
    if (oracle.trim()) {
      what.push('• This card’s main effect is described in its oracle text below.');
    } else {
      what.push('• This card does not have oracle text (or it was not available from Scryfall).');
    }
  }

  // ---- WHY PEOPLE PLAY IT (Commander-ish but safe)
  if (tags.includes('mana')) {
    why.push('• Mana acceleration is strong in Commander because games often revolve around big turns.');
    patterns.push('• Play it early if possible, then use the extra mana immediately.');
    tips.push('• Early ramp is usually more valuable than late ramp.');
  }
  if (tags.includes('card-draw')) {
    why.push('• Card draw prevents you from running out of gas (cards in hand).');
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
    tips.push('• Don’t counter small stuff unless it directly threatens you.');
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

  // ---- RULES NOTES / GOTCHAS (safe, common ones)
  if (o.includes('target')) {
    gotchas.push('• This card targets. If the target becomes illegal, the effect may fail.');
  }
  if (o.includes('exile')) {
    gotchas.push('• Exile is different from destroy: it usually prevents most death triggers and recursion.');
  }
  if (o.includes('until end of turn')) {
    gotchas.push('• “Until end of turn” effects wear off during the cleanup step at the end of the turn.');
  }
  if (tl.includes('equipment')) {
    gotchas.push('• Equipment must be attached by paying its equip cost (normally only at sorcery speed).');
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

  // ---- Commander-specific gentle notes
  if (cmc !== null && cmc >= 6) {
    tips.push('• This is a higher-cost card. Decks usually want ramp or cost reduction to cast it reliably.');
  }
  if (manaCost && manaCost.includes('{X}')) {
    tips.push('• X is chosen as you cast the spell, and it affects the total mana you pay.');
  }

  // Ensure each section has at least something (so UI never looks empty)
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

  // Themes (broad + safe)
  if (tags.includes('artifact')) themes.push('• Artifacts');
  if (tags.includes('enchantment')) themes.push('• Enchantments');
  if (tags.includes('instant') || tags.includes('sorcery') || tags.includes('cast-triggers')) themes.push('• Spellslinger (many instants/sorceries)');
  if (tags.includes('tokens')) themes.push('• Token swarm / go-wide');
  if (tags.includes('graveyard')) themes.push('• Graveyard / recursion');
  if (tags.includes('sacrifice')) themes.push('• Sacrifice / aristocrats');
  if (tags.includes('mana')) themes.push('• Ramp / big mana');
  if (oracle.includes('lifelink') || oracle.includes('gain life')) themes.push('• Lifegain');

  if (themes.length === 0) themes.push('• General value / good-stuff');

  // Pairings (types of cards)
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

  // Infin (we do NOT hallucinate; keep very generic)
  infin.push('• No specific infinite combo is suggested in free mode.');
  infin.push('• If you enable AI later, the app can suggest more detailed combo patterns.');

  // Avoid
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

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
  // Search / suggestions
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected card
  const [selectedName, setSelectedName] = useState<string>('');
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'explain' | 'synergies'>('explain');

  // Content
  const [standardExplanation, setStandardExplanation] = useState<string>('');
  const [standardSynergies, setStandardSynergies] = useState<string>('');
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiSynergies, setAiSynergies] = useState<string>('');

  // Loading
  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [isLoadingSynergy, setIsLoadingSynergy] = useState(false);

  // Notices (non-scary)
  const [notice, setNotice] = useState<string>('');

  // UX toggles
  const [preferManualFirst, setPreferManualFirst] = useState(true);
  const [autoFetchAI, setAutoFetchAI] = useState(false); // default OFF to stay free
  const [aiEnabled, setAiEnabled] = useState(false); // user can toggle it ON if they later add billing

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Debounced suggestions
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
    setIsLoadingCard(true);
    setCard(null);

    // Clear previous outputs
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

      // Always generate FREE content immediately (hybrid baseline)
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

    // If AI is not enabled, do not call it.
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
        // Hybrid behavior: never "break" — fall back calmly
        const status = res.status;

        if (status === 401) {
          setNotice('AI is unavailable (invalid API key). Showing standard explanation instead.');
        } else if (status === 429) {
          setNotice(
            'AI is unavailable (quota/billing). This app can run free using the standard explanation.'
          );
        } else {
          setNotice('AI is unavailable right now. Showing standard explanation.');
        }

        // If AI fails, we keep standard content (already generated).
        // Also turn AI off automatically to prevent repeated failures.
        setAiEnabled(false);

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

  // Auto-fetch AI only if user explicitly enabled AI + autoFetchAI
  useEffect(() => {
    if (!card) return;
    if (!aiEnabled) return;
    if (!autoFetchAI) return;

    // If we have a manual explainer and preferManualFirst, still allow AI to enhance,
    // but manual remains visible.
    fetchAI('explain');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, aiEnabled, autoFetchAI]);

  const cardImage = useMemo(() => getBestCardImage(card), [card]);
  const oracleText = useMemo(() => getOracleText(card), [card]);

  const showManual = Boolean(card && manual && (preferManualFirst || manualMatchIsExact));

  // What to display in each tab:
  // - Standard content always exists (free)
  // - AI content displays only if present
  const explainToShow = aiExplanation || standardExplanation;
  const synergiesToShow = aiSynergies || standardSynergies;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Explain My Card</h1>
            <p className="text-sm text-zinc-400">
              Search any Magic card. Get a clear explanation + beginner-friendly synergies.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <input
                type="checkbox"
                className="accent-zinc-200"
                checked={preferManualFirst}
                onChange={(e) => setPreferManualFirst(e.target.checked)}
              />
              Prefer manual explainer first
            </label>

            {/* Hybrid controls */}
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

            <label className={cx(
              'flex items-center gap-2 rounded-lg border px-3 py-2',
              aiEnabled ? 'border-zinc-800 bg-zinc-900/40 text-zinc-300' : 'border-zinc-900 bg-zinc-950 text-zinc-600'
            )}>
              <input
                type="checkbox"
                className="accent-zinc-200"
                checked={autoFetchAI}
                onChange={(e) => setAutoFetchAI(e.target.checked)}
                disabled={!aiEnabled}
              />
              Auto-fetch AI
            </label>
          </div>
        </div>

        {/* Search */}
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

                {/* Dropdown */}
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
                              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                                —
                              </div>
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

              <button
                type="submit"
                className="rounded-xl border border-zinc-800 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-2 text-xs text-zinc-500">Tip: click a dropdown result to load it instantly (best accuracy).</div>
        </div>

        {/* Notice (non-scary, hybrid-friendly) */}
        {notice ? (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-200">
            {notice}
          </div>
        ) : null}

        {/* Body */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left: Card */}
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
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                      {oracleText || 'No oracle text found.'}
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

          {/* Right: Explanation */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Explanation</div>
                <div className="text-xs text-zinc-500">
                  Manual for staples + standard (free) for everything + optional AI enhancement.
                </div>
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
                  {isLoadingExplain ? 'Trying AI…' : 'Try AI'}
                </button>
              </div>
            </div>

            {/* Manual explainer */}
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

            {/* Tabs */}
            <div className="mt-4 space-y-4">
              {activeTab === 'explain' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {aiExplanation ? 'AI-enhanced explanation' : 'Standard explanation (free)'}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {aiExplanation
                          ? 'This was generated by AI (when available).'
                          : 'This is generated locally from oracle text + simple rules.'}
                      </div>
                    </div>

                    {aiExplanation ? (
                      <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                        AI on
                      </div>
                    ) : (
                      <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                        Free mode
                      </div>
                    )}
                  </div>

                  {!card ? (
                    <div className="mt-3 text-sm text-zinc-400">Search a card to generate an explanation.</div>
                  ) : (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {explainToShow || 'No explanation available yet.'}
                    </pre>
                  )}
                </div>
              )}

              {activeTab === 'synergies' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {aiSynergies ? 'AI-enhanced synergies' : 'Standard synergies (free)'}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {aiSynergies
                          ? 'This was generated by AI (when available).'
                          : 'This is generated locally from oracle text + simple rules.'}
                      </div>
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
                      {isLoadingSynergy ? 'Trying AI…' : 'Try AI synergies'}
                    </button>
                  </div>

                  {!card ? (
                    <div className="mt-3 text-sm text-zinc-400">Search a card first.</div>
                  ) : (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {synergiesToShow || 'No synergies available yet.'}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
              Hybrid mode: the site is always usable for free. AI is optional and will never “break” the UI.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}