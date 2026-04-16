import { useState } from "react";
import DecoderDuel from "./DecoderDuel";
import LearnToricCode from "./LearnToricCode";
import QuantumQwirkle from "./QuantumQwirkle";
import StabilizerLesson from "./StabilizerLesson";

type Game = "decoder" | "stabilizer" | "learn" | "qwirkle";

export default function App() {
  const [game, setGame] = useState<Game>("decoder");
  const isQwirkleAvailable = false;

  const buttonStyle = (
    active: boolean,
    disabled = false,
  ): React.CSSProperties => ({
    padding: "10px 16px",
    borderRadius: 12,
    border: `1px solid ${
      disabled ? "#cbd5e1" : active ? "#0f172a" : "#cbd5e1"
    }`,
    background: disabled ? "#e2e8f0" : active ? "#0f172a" : "white",
    color: disabled ? "#64748b" : active ? "white" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.7 : 1,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Top bar */}
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #e2e8f0",
          background: "white",
          display: "flex",
          gap: 12,
        }}
      >
        <button
          style={buttonStyle(game === "decoder")}
          onClick={() => setGame("decoder")}
        >
          Decoder Duel
        </button>

        <button
          style={buttonStyle(game === "stabilizer")}
          onClick={() => setGame("stabilizer")}
        >
          Stabilizer Lesson
        </button>

        <button
          style={buttonStyle(game === "learn")}
          onClick={() => setGame("learn")}
        >
          Learn Toric Code
        </button>

        <button
          style={buttonStyle(game === "qwirkle", !isQwirkleAvailable)}
          onClick={() => {
            if (isQwirkleAvailable) {
              setGame("qwirkle");
            }
          }}
          disabled={!isQwirkleAvailable}
          aria-disabled={!isQwirkleAvailable}
          title="Quantum Qwirkle is temporarily disabled."
        >
          Quantum Qwirkle
        </button>
      </div>

      {/* Game view */}
      <div>
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
  );
}
