import { useState } from "react";
import DecoderDuel from "./DecoderDuel";
import QuantumQwirkle from "./QuantumQwirkle";

type Game = "decoder" | "qwirkle";

export default function App() {
  const [game, setGame] = useState<Game>("decoder");

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 16px",
    borderRadius: 12,
    border: `1px solid ${active ? "#0f172a" : "#cbd5e1"}`,
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    cursor: "pointer",
    fontWeight: 600,
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
          style={buttonStyle(game === "qwirkle")}
          onClick={() => setGame("qwirkle")}
        >
          Quantum Qwirkle
        </button>
      </div>

      {/* Game view */}
      <div>
        {game === "decoder" && <DecoderDuel />}
        {game === "qwirkle" && <QuantumQwirkle />}
      </div>
    </div>
  );
}