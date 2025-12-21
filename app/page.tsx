"use client";

import { useState } from "react";

// Beginner-friendly explanations you write (start small, expand over time)
const EXPLAINERS: Record<string, string> = {
  "Sol Ring":
    "Sol Ring is a fast mana card. It gives you 2 colorless mana for only 1 mana, which helps you play bigger spells earlier than normal. In Commander, it’s one of the strongest early-game ramp cards.",
  "Arcane Signet":
    "Arcane Signet is a ramp card. It taps for one mana of any color in your commander’s color identity, helping you cast your spells more consistently in Commander.",
};

// Structured synergy list with a reason. Clicking a synergy loads that card.
const SYNERGIES: Record<string, { name: string; reason: string }[]> = {
  "Sol Ring": [
    { name: "Arcane Signet", reason: "more fast mana to ramp early." },
    { name: "Thran Dynamo", reason: "a bigger ramp follow-up once you’re ahead." },
    { name: "Sensei’s Divining Top", reason: "extra mana helps you activate it repeatedly early." },
  ],
  "Arcane Signet": [
    { name: "Sol Ring", reason: "fast mana helps you cast Signet and accelerate quickly." },
    { name: "Command Tower", reason: "fixes colors and is a staple land in Commander." },
    { name: "Fellwar Stone", reason: "often taps for your colors in multiplayer games." },
  ],
};

export default function Home() {
  const [name, setName] = useState("");
  const [card, setCard] = useState<any>(null);
  const [error, setError] = useState("");

  async function fetchCardByExactName(cardName: string) {
    setError("");
    setCard(null);

    const cleaned = cardName.trim();
    if (!cleaned) {
      setError("Type a card name first (example: Sol Ring).");
      return;
    }

    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cleaned)}`
      );

      if (!res.ok) throw new Error("Card not found");

      const data = await res.json();
      setCard(data);
    } catch {
      setError("Card not found. Check spelling and try again.");
    }
  }

  async function fetchCard() {
    await fetchCardByExactName(name);
  }

  // Allow pressing Enter to search
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") fetchCard();
  }

  // Clicking synergy auto-fills search box + loads that card
  async function fetchCardByName(cardName: string) {
    setName(cardName);
    await fetchCardByExactName(cardName);
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 900 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Explain My Card</h1>
      <p style={{ marginTop: 0, lineHeight: 1.4 }}>
        Type a Magic: The Gathering card name to get a beginner-friendly explanation,
        suggested synergies, and format guidance.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder="e.g. Sol Ring"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: 10,
            width: 320,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />

        <button
          onClick={fetchCard}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #333",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Explain
        </button>
      </div>

      {error && (
        <p style={{ color: "red", marginTop: 12, fontWeight: 600 }}>{error}</p>
      )}

      {card && (
        <div style={{ marginTop: 24, display: "flex", gap: 20 }}>
          <div>
            {card.image_uris?.normal ? (
              <img src={card.image_uris.normal} width={260} alt={card.name} />
            ) : (
              <div
                style={{
                  width: 260,
                  height: 360,
                  border: "1px solid #ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                No image available
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ marginTop: 0 }}>{card.name}</h2>

            <p style={{ marginBottom: 6 }}>
              <strong>Mana cost:</strong> {card.mana_cost || "N/A"}
            </p>

            <p style={{ marginBottom: 6 }}>
              <strong>Type line:</strong> {card.type_line || "N/A"}
            </p>

            <p style={{ marginBottom: 6 }}>
              <strong>Rules text:</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{card.oracle_text || "N/A"}</p>

            <p style={{ marginTop: 16, marginBottom: 6 }}>
              <strong>What this means (beginner-friendly):</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {EXPLAINERS[card.name] ??
                "No beginner explanation written yet — but you can add one easily. (We’ll automate this later.)"}
            </p>

            <p style={{ marginTop: 16, marginBottom: 6 }}>
              <strong>Best format:</strong>{" "}
              {card.legalities?.commander === "legal"
                ? "Commander (EDH)"
                : "Not legal in Commander"}
            </p>

            <p style={{ marginTop: 16, marginBottom: 6 }}>
              <strong>Synergy ideas (click to load):</strong>
            </p>

            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {(SYNERGIES[card.name] ?? []).length > 0 ? (
                (SYNERGIES[card.name] ?? []).map((item, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <button
                      onClick={() => fetchCardByName(item.name)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: "blue",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: 700,
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