import React, { useMemo, useState } from "react";

const N = 4;

type Tool = "X" | "Z" | "Y";
type Tile = Tool | null;

const edgeKeyH = (r: number, c: number) => `h-${r}-${c}`;
const edgeKeyV = (r: number, c: number) => `v-${r}-${c}`;

function panelStyle(): React.CSSProperties {
  return {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };
}

function smallButton(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${active ? "#0f172a" : "#cbd5e1"}`,
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    cursor: "pointer",
    fontWeight: 600,
  };
}

function badgeStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e2e8f0",
    fontSize: 12,
    marginRight: 8,
    marginBottom: 8,
  };
}

export default function QuantumQwirkle() {
  const [tool, setTool] = useState<Tool>("Z");
  const [tiles, setTiles] = useState<Record<string, Tile>>({});
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const hEdges = useMemo(() => {
    const arr: Array<{ key: string; r: number; c: number }> = [];
    for (let r = 0; r <= N; r++) {
      for (let c = 0; c < N; c++) arr.push({ key: edgeKeyH(r, c), r, c });
    }
    return arr;
  }, []);

  const vEdges = useMemo(() => {
    const arr: Array<{ key: string; r: number; c: number }> = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c <= N; c++) arr.push({ key: edgeKeyV(r, c), r, c });
    }
    return arr;
  }, []);

  const analysis = useMemo(() => {
    const conflicts = new Set<string>();
    let rowScore = 0;
    let colScore = 0;

    // Horizontal lines: valid if they contain only Z and/or Y
    for (let r = 0; r <= N; r++) {
      const vals: Tool[] = [];
      const keys: string[] = [];

      for (let c = 0; c < N; c++) {
        const key = edgeKeyH(r, c);
        const val = tiles[key];
        if (val) {
          vals.push(val);
          keys.push(key);
        }
      }

      const hasX = vals.includes("X");
      const hasZY = vals.some((v) => v === "Z" || v === "Y");

      if (hasX && hasZY) {
        keys.forEach((key) => conflicts.add(key));
      } else if (keys.length >= 2 && !hasX) {
        rowScore += keys.length * keys.length;
      }
    }

    // Vertical lines: valid if they contain only X and/or Y
    for (let c = 0; c <= N; c++) {
      const vals: Tool[] = [];
      const keys: string[] = [];

      for (let r = 0; r < N; r++) {
        const key = edgeKeyV(r, c);
        const val = tiles[key];
        if (val) {
          vals.push(val);
          keys.push(key);
        }
      }

      const hasZ = vals.includes("Z");
      const hasXY = vals.some((v) => v === "X" || v === "Y");

      if (hasZ && hasXY) {
        keys.forEach((key) => conflicts.add(key));
      } else if (keys.length >= 2 && !hasZ) {
        colScore += keys.length * keys.length;
      }
    }

    const placedTiles = Object.values(tiles).filter(Boolean).length;
    const totalScore = rowScore + colScore - conflicts.size * 2;

    return {
      conflicts,
      rowScore,
      colScore,
      placedTiles,
      totalScore,
    };
  }, [tiles]);

  const placeTile = (key: string) => {
    setSelectedEdge(key);
    setTiles((prev) => ({
      ...prev,
      [key]: prev[key] === tool ? null : tool,
    }));
  };

  const reset = () => {
    setTiles({});
    setSelectedEdge(null);
  };

  const edgeBg = (key: string) => {
    if (analysis.conflicts.has(key)) return "#ef4444";
    const val = tiles[key];
    if (val === "X") return "#3b82f6";
    if (val === "Z") return "#ef4444";
    if (val === "Y") return "#8b5cf6";
    return "#94a3b8";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 24,
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={panelStyle()}>
            <h2 style={{ marginTop: 0 }}>Quantum Qwirkle</h2>
            <p style={{ color: "#475569", fontSize: 14 }}>
              Place quantum tiles so that <strong>rows prefer Z/Y</strong> and{" "}
              <strong>columns prefer X/Y</strong>. Tile <strong>Y</strong>{" "}
              behaves like both observables, so it can help one direction while
              risking conflict in the other.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <button style={smallButton(tool === "Z")} onClick={() => setTool("Z")}>
                Z
              </button>
              <button style={smallButton(tool === "X")} onClick={() => setTool("X")}>
                X
              </button>
              <button style={smallButton(tool === "Y")} onClick={() => setTool("Y")}>
                Y
              </button>
            </div>

            <button style={smallButton(false)} onClick={reset}>
              Reset board
            </button>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0 }}>Status</h3>
            <div>
              <span style={badgeStyle()}>Score: {analysis.totalScore}</span>
              <span style={badgeStyle()}>Placed tiles: {analysis.placedTiles}</span>
              <span style={badgeStyle()}>Conflicts: {analysis.conflicts.size}</span>
              <span style={badgeStyle()}>Row score: {analysis.rowScore}</span>
              <span style={badgeStyle()}>Column score: {analysis.colScore}</span>
            </div>
            {selectedEdge && (
              <div style={{ color: "#475569", marginBottom: 8 }}>
                Last edge: {selectedEdge}
              </div>
            )}
            <div style={{ color: "#475569", fontSize: 14 }}>
              Rows score with Z/Y only.
            </div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              Columns score with X/Y only.
            </div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              Each conflicting edge costs 2 points.
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0 }}>Rules</h3>
            <ul style={{ paddingLeft: 20, color: "#475569", marginBottom: 0 }}>
              <li>Edges are quantum tiles.</li>
              <li>Horizontal lines score when they contain only Z and Y tiles.</li>
              <li>Vertical lines score when they contain only X and Y tiles.</li>
              <li>Y behaves as both observables, so it can support either type of line.</li>
              <li>
                Conflicts appear when a row mixes X with Z/Y, or a column mixes Z
                with X/Y.
              </li>
              <li>Each valid line of length L scores L².</li>
            </ul>
          </div>
        </div>

        <div style={panelStyle()}>
          <h2 style={{ marginTop: 0 }}>Board</h2>
          <div
            style={{
              position: "relative",
              width: 760,
              height: 760,
              maxWidth: "100%",
              aspectRatio: "1 / 1",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              background: "white",
              margin: "0 auto",
            }}
          >
            {hEdges.map(({ key, r, c }) => (
              <button
                key={key}
                onClick={() => placeTile(key)}
                title={key}
                style={{
                  position: "absolute",
                  left: `${10 + c * 20}%`,
                  top: `${7 + r * 20}%`,
                  width: "18%",
                  height: 10,
                  borderRadius: 999,
                  border: "none",
                  background: edgeBg(key),
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tiles[key] ?? ""}
              </button>
            ))}

            {vEdges.map(({ key, r, c }) => (
              <button
                key={key}
                onClick={() => placeTile(key)}
                title={key}
                style={{
                  position: "absolute",
                  left: `${7 + c * 20}%`,
                  top: `${10 + r * 20}%`,
                  width: 10,
                  height: "18%",
                  borderRadius: 999,
                  border: "none",
                  background: edgeBg(key),
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-block", transform: "rotate(-90deg)" }}>
                  {tiles[key] ?? ""}
                </span>
              </button>
            ))}

            {Array.from({ length: N + 1 }).flatMap((_, r) =>
              Array.from({ length: N + 1 }).map((_, c) => (
                <div
                  key={`${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: `${10 + c * 20}%`,
                    top: `${10 + r * 20}%`,
                    width: 16,
                    height: 16,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: "2px solid #64748b",
                    background: "white",
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}