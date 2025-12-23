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

  "Swords to Plowshares":
    "Swords to Plowshares is a very efficient removal spell. It exiles a creature for just one mana, which permanently removes it. The creature’s controller gains life equal to its power, but the life gain is usually worth the trade to remove a dangerous threat.",

  "Rhystic Study":
    "Rhystic Study is a card-draw engine. Whenever an opponent casts a spell, they must either pay 1 extra mana or you draw a card. In multiplayer games, opponents often choose not to pay, which can let you draw many cards over the course of the game.",

  "Cultivate":
    "Cultivate is a ramp spell. You search your library for two basic lands: one goes onto the battlefield tapped, and the other goes into your hand. This both increases your mana for future turns and makes sure you keep hitting land drops.",

  "Kodama’s Reach":
    "Kodama’s Reach is basically Cultivate. You search for two basic lands: one enters the battlefield tapped, and the other goes into your hand. Commander decks often run both because they do the same strong job consistently.",

  "Path to Exile":
    "Path to Exile is a cheap removal spell that exiles a creature. The tradeoff is that the creature’s controller may search for a basic land and put it onto the battlefield tapped. Exiling is very strong, so giving them a land is often worth removing a big threat.",

  Counterspell:
    "Counterspell stops a spell from resolving. When you cast it, the spell you target is countered and goes to the graveyard instead of entering the battlefield or taking effect. This is a classic way to protect yourself from board wipes, combos, or big threats.",

  "Cyclonic Rift":
    "Cyclonic Rift returns nonland permanents to their owners’ hands. Normally it hits one permanent you don’t control, but if you pay the overload cost, it hits all nonland permanents your opponents control. In Commander, overloaded Rift often clears the board for a big winning swing.",

  "Lightning Bolt":
    "Lightning Bolt deals 3 damage to any target (a creature, player, or planeswalker). It’s simple but powerful: it can remove small creatures, finish off weakened creatures, or help close out a game.",

  "Smothering Tithe":
    "Smothering Tithe is a Treasure-making engine. Whenever an opponent draws a card, they must pay 2 mana or you create a Treasure token. Treasures can be sacrificed for mana, so this card can generate a huge mana advantage in multiplayer games.",

  "Mystic Remora":
    "Mystic Remora draws you cards when opponents cast noncreature spells unless they pay 4 mana. It has cumulative upkeep, meaning you must pay more and more mana each upkeep to keep it around. Many players use it early to draw a bunch of cards, then let it go when it gets too expensive.",

  Brainstorm:
    "Brainstorm lets you draw 3 cards, then put 2 cards from your hand back on top of your library. It’s best when you can shuffle your library afterward (like with a fetch land), so you don’t get stuck drawing the cards you put back.",

  "Sensei’s Divining Top":
    "Sensei’s Divining Top helps you control what you draw. You can look at the top three cards of your library and rearrange them, and you can also draw a card by putting Top on top of your library. It’s strong when you can generate extra mana or repeatedly shuffle your deck.",

  "Wrath of God":
    "Wrath of God is a board wipe. It destroys all creatures, and they can’t be regenerated. This resets the battlefield when someone is too far ahead or when you need time to stabilize.",

  "Teferi’s Protection":
    "Teferi’s Protection is a powerful defensive spell. Your life total can’t change and all your permanents phase out until your next turn, meaning they basically disappear and can’t be affected. This can save you from board wipes, huge attacks, or combo damage.",

  "Doubling Season":
    "Doubling Season doubles tokens you create and doubles counters placed on your permanents. This can supercharge token strategies and planeswalkers (because they enter with extra loyalty counters), but it’s important to remember it affects counters being placed, not counters being moved.",

  "The One Ring":
    "The One Ring protects you for a turn (you gain protection from everything until your next turn), and it draws cards over time by adding burden counters and drawing that many cards. You lose 1 life for each burden counter during your upkeep, so it’s strong card advantage but comes with a growing life cost.",

  "Dockside Extortionist":
    "Dockside Extortionist creates Treasure tokens based on how many artifacts and enchantments your opponents control. In Commander, that number can be huge, so Dockside often creates a big burst of mana that can enable explosive turns or combos.",
};

/* =========================
   SYNERGIES (starter set)
   ========================= */
const SYNERGIES: Record<string, { name: string; reason: string }[]> = {
  "Sol Ring": [
    { name: "Arcane Signet", reason: "more fast mana to ramp early." },
    { name: "Thran Dynamo", reason: "a bigger ramp follow-up once you’re ahead." },
    { name: "Sensei’s Divining Top", reason: "extra mana helps you activate it repeatedly early." },
  ],
  "Arcane Signet": [
    { name: "Sol Ring", reason: "fast mana helps you accelerate quickly." },
    { name: "Command Tower", reason: "fixes colors and is a staple land in Commander." },
    { name: "Fellwar Stone", reason: "often taps for your colors in multiplayer games." },
  ],
  "Rhystic Study": [
    { name: "Smothering Tithe", reason: "both tax opponents and generate huge advantage." },
    { name: "Mystic Remora", reason: "another early card-draw engine in similar decks." },
    { name: "Counterspell", reason: "protect your draw engine from removal." },
  ],
};

type ScryfallCard = {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  legalities?: { commander?: string };
  image_uris?: { normal?: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; small?: string } }>;
};

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

  // AI explanation fallback
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiCache = useRef(new Map<string, string>());

  // Autocomplete UI state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Suggestions w/ images + cache
  const [suggestionCards, setSuggestionCards] = useState<
    { name: string; img?: string }[]
  >([]);
  const suggestionCache = useRef(new Map<string, string | undefined>());

  const debouncedQuery = useDebouncedValue(name, 180);

  async function fetchAIExplanation(c: ScryfallCard) {
    const key = c?.name?.trim();
    if (!key) return;

    // If you have a manual explainer, do not call AI
    if (EXPLAINERS[key]) {
      setAiExplanation("");
      return;
    }

    const cached = aiCache.current.get(key);
    if (cached) {
      setAiExplanation(cached);
      return;
    }

    setAiLoading(true);
    setAiExplanation("");

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
      const text = (data?.explanation ?? "").toString().trim();

      if (text) {
        aiCache.current.set(key, text);
        setAiExplanation(text);
      }
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  }

  async function fetchCardByExactName(cardName: string) {
    setError("");
    setCard(null);
    setAiExplanation("");

    const cleaned = cardName.trim();
    if (!cleaned) {
      setError("Type a card name first (example: Sol Ring).");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cleaned)}`
      );

      if (!res.ok) throw new Error("Card not found");
      const data: ScryfallCard = await res.json();

      setCard(data);
      fetchAIExplanation(data);

      setShowSuggestions(false);
      setActiveIndex(-1);
    } catch {
      setError("Card not found. Check spelling and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCard() {
    await fetchCardByExactName(name);
  }

  async function fetchCardByName(cardName: string) {
    setName(cardName);
    setShowSuggestions(false);
    setActiveIndex(-1);
    await fetchCardByExactName(cardName);
  }

  // Autocomplete: fetch suggestions + small images for top results
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
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const list: string[] = Array.isArray(data?.data) ? data.data : [];
        const top = list.slice(0, 8);

        setSuggestions(top);
        setShowSuggestions(true);
        setActiveIndex(-1);

        // fetch small images for up to 6 suggestions (keeps it fast)
        const withImgs = await Promise.all(
          top.slice(0, 6).map(async (nm) => {
            if (suggestionCache.current.has(nm)) {
              return { name: nm, img: suggestionCache.current.get(nm) };
            }

            try {
              const r = await fetch(
                `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nm)}`
              );
              if (!r.ok) {
                suggestionCache.current.set(nm, undefined);
                return { name: nm, img: undefined };
              }
              const c: ScryfallCard = await r.json();
              const img =
                c?.image_uris?.small ||
                c?.card_faces?.[0]?.image_uris?.small ||
                undefined;

              suggestionCache.current.set(nm, img);
              return { name: nm, img };
            } catch {
              suggestionCache.current.set(nm, undefined);
              return { name: nm, img: undefined };
            }
          })
        );

        if (!cancelled) setSuggestionCards(withImgs);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      if (!showSuggestions) setShowSuggestions(true);
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      setActiveIndex((prev) => Math.max(prev - 1, -1));
      return;
    }

    if (e.key === "Enter") {
      const pick =
        (suggestionCards[activeIndex]?.name ?? suggestions[activeIndex]) || "";

      if (showSuggestions && activeIndex >= 0 && pick) {
        e.preventDefault();
        fetchCardByName(pick);
        return;
      }

      fetchCard();
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
    return suggestions.slice(0, 8).map((n) => ({
      name: n,
      img: imgMap.get(n),
    }));
  }, [suggestionCards, suggestions]);

  const mainImage =
    card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal;
  const explanationText =
    (card?.name?.trim() && EXPLAINERS[card.name.trim()]) ||
    (aiLoading ? "Generating a beginner-friendly explanation..." : aiExplanation) ||
    "No beginner explanation yet.";

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1000 }}>
      <h1 style={{ fontSize: 44, marginBottom: 8, color: "white" }}>
        Explain My Card
      </h1>

      <p style={{ marginTop: 0, lineHeight: 1.4, color: "white", maxWidth: 900 }}>
        Type a Magic: The Gathering card name to get a beginner-friendly explanation,
        suggested synergies, and format guidance.
      </p>

      <div style={{ position: "relative", display: "inline-block" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={inputRef}
            placeholder="e.g. Sol Ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (dropdownItems.length > 0) setShowSuggestions(true);
            }}
            style={{
              padding: 10,
              width: 420,
              borderRadius: 10,
              border: "1px solid #333",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />

          <button
            onClick={fetchCard}
            disabled={isLoading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #555",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: 700,
              background: "#111",
              color: "white",
            }}
          >
            {isLoading ? "Searching..." : "Explain"}
          </button>
        </div>

        {showSuggestions && dropdownItems.length > 0 && (
          <div
            ref={suggestionsRef}
            style={{
              position: "absolute",
              top: 46,
              left: 0,
              width: 420,
              background: "#111",
              border: "1px solid #333",
              borderRadius: 10,
              boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            {dropdownItems.map((item, i) => (
              <div
                key={item.name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  fetchCardByName(item.name);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: i === activeIndex ? "#222" : "#111",
                  color: "#f5f5f5",
                  borderBottom:
                    i === dropdownItems.length - 1 ? "none" : "1px solid #333",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {item.img ? (
                    <img
                      src={item.img}
                      alt=""
                      width={28}
                      height={40}
                      style={{ borderRadius: 4, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 40,
                        borderRadius: 4,
                        background: "#222",
                        border: "1px solid #333",
                      }}
                    />
                  )}
                  <span style={{ fontWeight: 650 }}>{item.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: "#ff6b6b", marginTop: 12, fontWeight: 700 }}>
          {error}
        </p>
      )}

      {card && (
        <div style={{ marginTop: 28, display: "flex", gap: 22, alignItems: "flex-start" }}>
          <div>
            {mainImage ? (
              <img src={mainImage} width={280} alt={card.name || "Card"} />
            ) : (
              <div
                style={{
                  width: 280,
                  height: 390,
                  border: "1px solid #333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  color: "white",
                  background: "#111",
                }}
              >
                No image available
              </div>
            )}
          </div>

          <div style={{ flex: 1, color: "white" }}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>{card.name}</h2>

            <p style={{ marginBottom: 6 }}>
              <strong>Mana cost:</strong> {card.mana_cost || "N/A"}
            </p>

            <p style={{ marginBottom: 6 }}>
              <strong>Type line:</strong> {card.type_line || "N/A"}
            </p>

            <p style={{ marginBottom: 6 }}>
              <strong>Rules text:</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>
              {card.oracle_text || "N/A"}
            </p>

            <p style={{ marginTop: 16, marginBottom: 6 }}>
              <strong>Beginner explanation:</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>
              {explanationText}
            </p>

            <p style={{ marginTop: 16, marginBottom: 6 }}>
              <strong>Best format:</strong> {bestFormat}
            </p>

            <p style={{ marginTop: 16, marginBottom: 6 }}>
              <strong>Synergy ideas (click to load):</strong>
            </p>

            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {(SYNERGIES[card.name || ""] ?? []).length > 0 ? (
                (SYNERGIES[card.name || ""] ?? []).map((item, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <button
                      onClick={() => fetchCardByName(item.name)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: "#7db7ff",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: 750,
                      }}
                    >
                      {item.name}
                    </button>
                    <span> — {item.reason}</span>
                  </li>
                ))
              ) : (
                <li>No synergy data yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}