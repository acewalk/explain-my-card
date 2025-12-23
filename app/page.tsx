'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

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
  legalities?: Record<string, string>;
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

// ---- Manual explainers (~20 staples) ----
// Keep these exactly how you like them; add more any time.
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
    tips: [
      'Best on turn 1 or 2; early ramp matters most.',
      'If your deck is very color-hungry, pair it with colored rocks/lands.',
    ],
    gotchas: ['Makes you a target if you start too fast — consider your table politics.'],
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
    why: ['Exiles (beats indestructible & death triggers).', 'Only 1 mana.'],
    tips: ['Save it for the scariest creature, not the first creature.'],
    gotchas: ['Opponent gains life — usually worth it.'],
  },
  'Path to Exile': {
    title: 'Path to Exile',
    short: 'Efficient exile removal that gives the opponent a basic land.',
    why: ['Exiles for 1 mana.', 'Stops indestructible and recursion lines.'],
    tips: ['Use on the biggest threat, or when the land won’t matter much.'],
    gotchas: ['Ramp is real — be careful early game.'],
  },
  'Rhystic Study': {
    title: 'Rhystic Study',
    short: 'Tax effect that draws you cards when opponents don’t pay 1.',
    why: ['Generates massive card advantage over a game.', 'Forces opponents into awkward choices.'],
    tips: ['Say “Pay the 1?” consistently. Track triggers carefully.'],
    gotchas: ['You will become the archenemy if you draw too much.'],
  },
  'Smothering Tithe': {
    title: 'Smothering Tithe',
    short: 'Creates Treasure when opponents draw unless they pay 2.',
    why: ['Explosive mana advantage.', 'Treasures fix colors and enable big turns.'],
    tips: ['Sequence your turns to convert Treasures into immediate advantage.'],
    gotchas: ['Table will usually aim removal at it quickly.'],
  },
  'Cyclonic Rift': {
    title: 'Cyclonic Rift',
    short: 'Overloaded: bounces all nonlands you don’t control (one-sided reset).',
    why: ['Massive tempo swing.', 'Breaks board stalls and opens lethal attacks.'],
    tips: ['Often best cast on the end step before your turn.'],
    gotchas: ['Doesn’t permanently answer threats; they can replay them if they survive.'],
  },
  'Demonic Tutor': {
    title: 'Demonic Tutor',
    short: 'Search your library for any card (best-in-class tutor).',
    why: ['Finds answers or win conditions.', 'Increases consistency hugely.'],
    tips: ['Tutor with a plan: “What am I doing the next 2 turns?”'],
    gotchas: ['Tutors can make games repetitive; some tables dislike them.'],
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
    tips: ['Same play pattern as Cultivate — plan ahead for colors.'],
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
    why: ['Protection without shroud downside.', 'Still enables immediate value.'],
    tips: ['If you need to target your own creature a lot, Boots > Greaves.'],
  },
  'Esper Sentinel': {
    title: 'Esper Sentinel',
    short: 'Early tax creature that draws cards when opponents cast noncreature spells.',
    why: ['Great turn-1 play in white.', 'Punishes decks full of rocks/removal/draw.'],
    tips: ['Buff its power to increase the tax.'],
  },
  'The One Ring': {
    title: 'The One Ring',
    short: 'Protection for a turn + scalable card draw (with a life-cost clock).',
    why: ['Immediate safety and huge card advantage.', 'Fits many decks.'],
    tips: ['Plan how you’ll remove/reset burden counters (bounce/sac/clone).'],
    gotchas: ['Burden counters drain life — don’t get greedy if you’re under pressure.'],
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
    tips: ['Use early to fix colors; it always enters tapped indirectly.'],
  },
  'Mystic Remora': {
    title: 'Mystic Remora',
    short: 'Early-game draw engine vs noncreature spells; upkeep tax grows.',
    why: ['Punishes fast mana and early interaction.', 'Draws absurd cards early.'],
    tips: ['Often correct to let it die after 1–2 upkeeps.'],
  },
  'Brainstorm': {
    title: 'Brainstorm',
    short: 'Draw 3, put 2 back — best with shuffle effects.',
    why: ['Fixes hands and hides key cards.', 'Combos with fetchlands to “clean” the top.'],
    tips: ['Try to pair with a shuffle (Fabled Passage, Evolving Wilds, etc.).'],
    gotchas: ['Without shuffle/top manipulation, it can lock bad cards on top.'],
  },
};

const MANUAL_KEYS = new Set(Object.keys(MANUAL_EXPLAINERS).map((k) => k.toLowerCase().trim()));

// ---- Small helpers ----
function normalizeName(n: string) {
  return n.toLowerCase().trim();
}

function getBestCardImage(card: ScryfallCard | null): string | null {
  if (!card) return null;
  // Double-faced / split cards often store images on card_faces.
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

  if (o.includes('draw a card') || o.includes('draw two') || o.includes('cards')) tags.push('card-draw');
  if (o.includes('treasure')) tags.push('treasure');
  if (o.includes('create') && (o.includes('token') || o.includes('tokens'))) tags.push('tokens');
  if (o.includes('counter target') || o.includes('counterspell')) tags.push('countermagic');
  if (o.includes('destroy') || o.includes('exile')) tags.push('removal');
  if (o.includes('each opponent')) tags.push('each-opponent');
  if (o.includes('whenever you cast')) tags.push('cast-triggers');
  if (o.includes('enters the battlefield')) tags.push('etb');
  if (o.includes('sacrifice')) tags.push('sacrifice');
  if (o.includes('graveyard')) tags.push('graveyard');

  return Array.from(new Set(tags));
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

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

  // Explanations
  const [activeTab, setActiveTab] = useState<'explain' | 'synergies'>('explain');
  const [explanation, setExplanation] = useState<string>('');
  const [synergies, setSynergies] = useState<string>('');
  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [isLoadingSynergy, setIsLoadingSynergy] = useState(false);
  const [error, setError] = useState<string>('');

  // UX toggles
  const [preferManualFirst, setPreferManualFirst] = useState(true);
  const [autoFetchAI, setAutoFetchAI] = useState(true);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const manual = useMemo(() => {
    const key = normalizeName(selectedName || query);
    // Exact match on manual keys:
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
      if (!dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Debounced suggestion fetch
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
        // Scryfall autocomplete gives just names
        const acRes = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`);
        const acJson = await safeJson(acRes);

        const names: string[] = Array.isArray(acJson?.data) ? acJson.data.slice(0, 8) : [];

        // Fetch minimal card info for each name (for small images)
        const cards: Suggestion[] = [];
        for (const name of names) {
          try {
            const namedRes = await fetch(
              `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
            );
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
        // Just silently fail suggestions; don't break UI
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

    setError('');
    setIsLoadingCard(true);
    setCard(null);
    setExplanation('');
    setSynergies('');
    setActiveTab('explain');

    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(n)}`);
      const json = (await safeJson(res)) as ScryfallCard | null;

      if (!res.ok || !json?.name) {
        setError('Could not find that card on Scryfall. Check spelling and try again.');
        setCard(null);
        return;
      }

      setCard(json);
    } catch {
      setError('Network error while loading card data. Please try again.');
      setCard(null);
    } finally {
      setIsLoadingCard(false);
    }
  }

  async function fetchAIExplanation(mode: 'explain' | 'synergies') {
    if (!card) return;

    const payload = {
      mode, // <-- new: lets your /api/explain route choose a better prompt
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
      // you can also send user preferences so the API can tailor the tone
      prefs: {
        audience: 'beginner',
        format: 'bulleted-with-sections',
        concise: false,
        commanderFocus: true,
      },
    };

    if (mode === 'explain') {
      setIsLoadingExplain(true);
      setExplanation('');
    } else {
      setIsLoadingSynergy(true);
      setSynergies('');
    }
    setError('');

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(res);

      if (!res.ok) {
        const msg =
          json?.error ||
          json?.message ||
          'AI request failed. If this persists, your /api/explain route may be misconfigured.';
        setError(String(msg));
        return;
      }

      // Backwards compatible:
      // - old route: { explanation: "..." }
      // - newer route: { explanation: "...", synergies: "..." }
      const text =
        mode === 'explain'
          ? (json?.explanation as string) || (json?.text as string) || ''
          : (json?.synergies as string) || (json?.explanation as string) || (json?.text as string) || '';

      if (!text) {
        setError('AI returned an empty response. Check your /api/explain output format.');
        return;
      }

      if (mode === 'explain') setExplanation(text);
      else setSynergies(text);
    } catch {
      setError('Network error while calling /api/explain. Please try again.');
    } finally {
      if (mode === 'explain') setIsLoadingExplain(false);
      else setIsLoadingSynergy(false);
    }
  }

  // Auto-fetch AI after card loads (unless manual-only preferred)
  useEffect(() => {
    if (!card) return;

    // If we have a manual explainer and user prefers manual first, we can optionally skip auto AI.
    if (preferManualFirst && manualMatchIsExact) {
      // Only auto-fetch AI if the user enabled it
      if (autoFetchAI) fetchAIExplanation('explain');
      return;
    }

    if (autoFetchAI) fetchAIExplanation('explain');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

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

  const cardImage = useMemo(() => getBestCardImage(card), [card]);
  const oracleText = useMemo(() => getOracleText(card), [card]);

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

            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <input
                type="checkbox"
                className="accent-zinc-200"
                checked={autoFetchAI}
                onChange={(e) => setAutoFetchAI(e.target.checked)}
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
                  ref={inputRef}
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
                    {isSuggesting && (
                      <div className="px-4 py-3 text-sm text-zinc-400">Searching…</div>
                    )}

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

          <div className="mt-2 text-xs text-zinc-500">
            Tip: click a dropdown result to load it instantly (best accuracy).
          </div>
        </div>

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
                  Manual explainer for staples + AI fallback for everything else.
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
                  onClick={() => card && fetchAIExplanation('explain')}
                  disabled={!card || isLoadingExplain}
                  className={cx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold',
                    !card || isLoadingExplain
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-500'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900'
                  )}
                  title={!card ? 'Search a card first' : 'Re-run AI explanation'}
                >
                  {isLoadingExplain ? 'Refreshing…' : 'Refresh AI'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error ? (
              <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {/* Content */}
            <div className="mt-4 space-y-4">
              {/* Manual explainer (if exact match + preferManualFirst) */}
              {card && manual && (preferManualFirst || !explanation) && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Manual explainer</div>
                      <div className="mt-1 text-xs text-zinc-500">{manual.title}</div>
                    </div>

                    <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                      Staples library
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-zinc-200">{manual.short}</div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="text-xs font-semibold text-zinc-200">Why people play it</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                        {manual.why.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="text-xs font-semibold text-zinc-200">Tips</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                        {manual.tips.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {manual.gotchas?.length ? (
                    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="text-xs font-semibold text-zinc-200">Gotchas</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                        {manual.gotchas.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Tabs */}
              {activeTab === 'explain' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-zinc-100">AI explanation</div>
                    <div className="text-xs text-zinc-500">
                      {card ? 'Uses card rules text + context tags' : 'Search a card to begin'}
                    </div>
                  </div>

                  {!card ? (
                    <div className="mt-3 text-sm text-zinc-400">Search a card to generate an explanation.</div>
                  ) : isLoadingExplain ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-4 w-5/6 rounded bg-zinc-800" />
                      <div className="h-4 w-11/12 rounded bg-zinc-800" />
                      <div className="h-4 w-2/3 rounded bg-zinc-800" />
                      <div className="h-4 w-3/4 rounded bg-zinc-800" />
                    </div>
                  ) : explanation ? (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {explanation}
                    </pre>
                  ) : (
                    <div className="mt-3 text-sm text-zinc-400">
                      No AI explanation yet. Click <span className="font-semibold text-zinc-200">Refresh AI</span>.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'synergies' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Synergies & combos</div>
                      <div className="text-xs text-zinc-500">
                        Beginner-friendly ideas: themes, pairings, and common lines.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => card && fetchAIExplanation('synergies')}
                      disabled={!card || isLoadingSynergy}
                      className={cx(
                        'rounded-xl border px-3 py-2 text-xs font-semibold',
                        !card || isLoadingSynergy
                          ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800/60'
                      )}
                    >
                      {isLoadingSynergy ? 'Finding synergies…' : 'Generate synergies'}
                    </button>
                  </div>

                  {!card ? (
                    <div className="mt-3 text-sm text-zinc-400">Search a card first.</div>
                  ) : isLoadingSynergy ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-zinc-800" />
                      <div className="h-4 w-11/12 rounded bg-zinc-800" />
                      <div className="h-4 w-5/6 rounded bg-zinc-800" />
                      <div className="h-4 w-2/3 rounded bg-zinc-800" />
                    </div>
                  ) : synergies ? (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {synergies}
                    </pre>
                  ) : (
                    <div className="mt-3 text-sm text-zinc-400">
                      Click <span className="font-semibold text-zinc-200">Generate synergies</span> to get pairing ideas.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
              If a card has a manual explainer, you’ll see it here. AI is used for everything else — or to expand detail.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}