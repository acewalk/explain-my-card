"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* =========================
   BEGINNER EXPLANATIONS (20)
   ========================= */
const EXPLAINERS: Record<string, string> = {
  "Sol Ring":
    "Sol Ring is a fast mana card. You pay 1 mana to cast it, and it taps for 2 colorless mana. This lets you play bigger spells earlier than normal. In Commander, this often means getting ahead of the table very quickly if you draw it early.",

  "Arcane Signet":
    "Arcane Signet is a mana ramp card. It taps for one mana of any color in your commander’s color identity. This helps you consistently cast your spells, especially in multi-color Commander decks.",

  "Command Tower":
    "Command Tower is a land that taps for any color in your commander’s color identity. Because it always fixes your colors with no downside, it is considered one of the best lands in Commander and is played in most decks.",

  "Cultivate":
    "Cultivate is a ramp spell. You search your library for two basic lands: one goes onto the battlefield tapped, and the other goes into your hand. This both increases your mana for future turns and helps ensure you keep hitting land drops.",

  "Kodama’s Reach":
    "Kodama’s Reach does the same thing as Cultivate. Commander decks often run both because they provide consistent ramp and card advantage.",

  "Swords to Plowshares":
    "Swords to Plowshares is a very efficient removal spell. It exiles a creature for just one mana. The life gain is usually worth removing a dangerous threat.",

  "Path to Exile":
    "Path to Exile exiles a creature, but its controller may search for a basic land. Exiling is powerful, so the downside is often acceptable.",

  "Counterspell":
    "Counterspell stops a spell from resolving and sends it to the graveyard. It is a classic defensive tool.",

  "Cyclonic Rift":
    "Cyclonic Rift returns nonland permanents to their owners’ hands. When overloaded, it clears all opponents’ boards and often enables winning turns.",

  "Lightning Bolt":
    "Lightning Bolt deals 3 damage to any target. It’s efficient removal or a way to finish opponents.",

  "Rhystic Study":
    "Rhystic Study draws cards whenever opponents cast spells unless they pay extra mana. In multiplayer, this often draws many cards.",

  "Smothering Tithe":
    "Smothering Tithe creates Treasure tokens when opponents draw cards unless they pay mana. This often generates huge mana advantages.",

  "Mystic Remora":
    "Mystic Remora draws cards when opponents cast noncreature spells unless they pay mana. It’s strongest early in the game.",

  "Brainstorm":
    "Brainstorm draws three cards, then you put two back on top of your library. It’s best when you can shuffle afterward.",

  "Sensei’s Divining Top":
    "Sensei’s Divining Top lets you control your draws by rearranging the top of your library.",

  "Wrath of God":
    "Wrath of God destroys all creatures and prevents regeneration, resetting the board.",

  "Teferi’s Protection":
    "Teferi’s Protection phases out your permanents and protects your life total, saving you from almost anything for a turn.",

  "Doubling Season":
    "Doubling Season doubles tokens and counters you create, supercharging token and planeswalker strategies.",

  "The One Ring":
    "The One Ring protects you for a turn and draws increasing cards over time, but drains your life.",

  "Dockside Extortionist":
    "Dockside Extortionist creates Treasure tokens based on opponents’ artifacts and enchantments, often generating explosive mana.",
};

/* ========================= */

const SYNERGIES: Record<string, { name: string; reason: string }[]> = {
  "Sol Ring": [
    { name: "Arcane Signet", reason: "more fast mana early." },
    { name: "Thran Dynamo", reason: "big follow-up ramp." },
  ],
  "Arcane Signet": [
    { name: "Sol Ring", reason: "fast acceleration." },
    { name: "Command Tower", reason: "perfect color fixing." },
  ],
};

type ScryfallCard = any;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export default function Home() {
  const [name, setName] = useState("");
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // AI explanation state
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiCache = useRef(new Map<string, string>());

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionCards, setSuggestionCards] = useState<
    { name: string; img?: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionCache = useRef(new Map<string, string | undefined>());

  const debouncedQuery = useDebouncedValue(name, 180);

  /* =========================
     AUTOCOMPLETE
     ========================= */
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestionCards([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;

    (async () => {
      const res = await fetch(
        `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;

      const names: string[] = data.data.slice(0, 8);
      setSuggestions(names);
      setShowSuggestions(true);
      setActiveIndex(-1);

      const cards = await Promise.all(
        names.map(async (n) => {
          if (suggestionCache.current.has(n)) {
            return { name: n, img: suggestionCache.current.get(n) };
          }
          try {
            const r = await fetch(
              `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(n)}`
            );
            if (!r.ok) return { name: n };
            const c = await r.json();
            const img =
              c?.image_uris?.small ||
              c?.card_faces?.[0]?.image_uris?.small;
            suggestionCache.current.set(n, img);
            return { name: n, img };
          } catch {
            return { name: n };
          }
        })
      );

      if (!cancelled) setSuggestionCards(cards);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  /* =========================
     FETCH CARD + AI
     ========================= */
  async function fetchAIExplanation(c: any) {
    const key = c?.name?.trim();
    if (!key || EXPLAINERS[key]) {
      setAiExplanation("");
      return;
    }

    const cached = aiCache.current.get(key);
    if (cached) {
      setAiExplanation(cached);
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name,
          mana_cost: c.mana_cost,
          type_line: c.type_line,
          oracle_text: c.oracle_text,
        }),
      });
      const data = await res.json();
      if (data?.explanation) {
        aiCache.current.set(key, data.explanation);
        setAiExplanation(data.explanation);
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function fetchCardByExactName(cardName: string) {
    setError("");
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(
          cardName.trim()
        )}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCard(data);
      fetchAIExplanation(data);
    } catch {
      setError("Card not found.");
    } finally {
      setIsLoading(false);
    }
  }

  const bestFormat = useMemo(() => {
    if (!card) return "";
    return card.legalities?.commander === "legal"
      ? "Commander (EDH)"
      : "Not legal in Commander";
  }, [card]);

  const dropdownItems = useMemo(() => {
    const imgMap = new Map(suggestionCards.map((x) => [x.name, x.img]));
    return suggestions.map((n) => ({ name: n, img: imgMap.get(n) }));
  }, [suggestions, suggestionCards]);

  return (
    <main style={{ padding: 24, maxWidth: 900, color: "white" }}>
      <h1>Explain My Card</h1>

      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchCardByExactName(name)}
          placeholder="e.g. Sol Ring"
          style={{
            width: 360,
            padding: 10,
            borderRadius: 8,
            background: "#111",
            color: "white",
            border: "1px solid #333",
          }}
        />

        {showSuggestions && dropdownItems.length > 0 && (
          <div
            ref={suggestionsRef}
            style={{
              position: "absolute",
              width: 360,
              background: "#111",
              border: "1px solid #333",
              borderRadius: 8,
              marginTop: 4,
            }}
          >
            {dropdownItems.map((item) => (
              <div
                key={item.name}
                onMouseDown={() => fetchCardByExactName(item.name)}
                style={{
                  padding: 10,
                  display: "flex",
                  gap: 10,
                  cursor: "pointer",
                  borderBottom: "1px solid #222",
                }}
              >
                {item.img && <img src={item.img} width={28} />}
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {card && (
        <div style={{ marginTop: 24, display: "flex", gap: 20 }}>
          <img src={card.image_uris?.normal} width={260} />
          <div>
            <h2>{card.name}</h2>
            <p>{card.oracle_text}</p>

            <h4>Beginner explanation</h4>
            <p>
              {EXPLAINERS[card.name] ??
                (aiLoading
                  ? "Generating explanation..."
                  : aiExplanation)}
            </p>

            <p>
              <strong>Best format:</strong> {bestFormat}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
