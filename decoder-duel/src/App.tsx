import { useState } from "react";
import DecoderDuel from "./DecoderDuel";
import LearnToricCode from "./LearnToricCode";
import QuantumQwirkle from "./QuantumQwirkle";
import StabilizerLesson from "./StabilizerLesson";

type Game = "decoder" | "stabilizer" | "learn" | "qwirkle";

type NavSection = {
  title: string;
  description: string;
  items: Array<{
    id: Game;
    label: string;
    description: string;
    disabled?: boolean;
    disabledReason?: string;
  }>;
};

export default function App() {
  const [game, setGame] = useState<Game>("learn");
  const isQwirkleAvailable = false;

  const navSections: NavSection[] = [
    {
      title: "Learning",
      description: "Guided modules that teach the stabilizer and toric-code ideas step by step.",
      items: [
        {
          id: "stabilizer",
          label: "Stabilizer Lesson",
          description: "Build intuition for stabilizer codes before moving to the lattice picture.",
        },
        {
          id: "learn",
          label: "Learn Toric Code",
          description: "Work through the toric-code lattice, syndromes, loops, and decoding ideas.",
        },
      ],
    },
    {
      title: "Games",
      description: "Interactive play modes that turn the same ideas into competition and experimentation.",
      items: [
        {
          id: "decoder",
          label: "Decoder Duel",
          description: "Play directly on the lattice with scorekeeping, modes, and decoder suggestions.",
        },
        {
          id: "qwirkle",
          label: "Quantum Qwirkle",
          description: "A strategy game variant inspired by quantum-code structure.",
          disabled: !isQwirkleAvailable,
          disabledReason: "Quantum Qwirkle is temporarily disabled.",
        },
      ],
    },
  ];

  const buttonStyle = (
    active: boolean,
    disabled = false,
  ): React.CSSProperties => ({
    width: "100%",
    padding: "12px 14px",
    borderRadius: 16,
    border: `1px solid ${
      disabled ? "#cbd5e1" : active ? "#0f766e" : "#d7e1ea"
    }`,
    background: disabled
      ? "#e2e8f0"
      : active
        ? "linear-gradient(135deg, #0f766e 0%, #2563eb 100%)"
        : "rgba(255,255,255,0.92)",
    color: disabled ? "#64748b" : active ? "white" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.7 : 1,
    textAlign: "left",
    boxShadow: active ? "0 10px 22px rgba(37, 99, 235, 0.16)" : "none",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #dff7f1 0%, transparent 26%), linear-gradient(180deg, #f7fbff 0%, #eef4fb 52%, #e6edf7 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          padding: 18,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,248,255,0.94) 100%)",
            border: "1px solid #d7e1ea",
            borderRadius: 22,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
            padding: 16,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 0.95fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div style={{ padding: "4px 6px 4px 2px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#0f766e",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Quantum Playground
              </div>
              <h1 style={{ margin: "0 0 6px", fontSize: 24, lineHeight: 1.1, color: "#0f172a" }}>
                Learning And Games
              </h1>
              <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
                Learn in guided modules or jump into play.
              </p>
            </div>

            {navSections.map((section) => (
              <div
                key={section.title}
                style={{
                  border: "1px solid #dbe5f0",
                  borderRadius: 18,
                  padding: 14,
                  background: "rgba(248, 250, 252, 0.8)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 6 }}>
                  {section.title}
                </div>
                <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
                  {section.description}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      style={buttonStyle(game === item.id, item.disabled)}
                      onClick={() => {
                        if (!item.disabled) {
                          setGame(item.id);
                        }
                      }}
                      disabled={item.disabled}
                      aria-disabled={item.disabled}
                      title={item.disabledReason}
                    >
                      <div style={{ fontSize: 14, marginBottom: 3 }}>{item.label}</div>
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: item.disabled
                            ? "#64748b"
                            : game === item.id
                              ? "rgba(255,255,255,0.9)"
                              : "#475569",
                          fontWeight: 500,
                        }}
                      >
                        {item.disabled ? item.disabledReason : item.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
          }}
        >
          {game === "decoder" && <DecoderDuel />}
          {game === "stabilizer" && <StabilizerLesson />}
          {game === "learn" && (
            <LearnToricCode
              initialStepId="intro"
              moduleTitle="Learn Toric Code"
              moduleSubtitle="A toric-code lesson that begins from the lattice picture and builds toward topology-aware decoding."
            />
          )}
          {game === "qwirkle" && isQwirkleAvailable && <QuantumQwirkle />}
        </div>
      </div>
    </div>
  );
}
