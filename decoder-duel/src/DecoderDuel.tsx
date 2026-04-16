import React, { useMemo, useState } from "react";

const N = 4;

const edgeKeyH = (r: number, c: number) => `h-${r}-${c}`;
const edgeKeyV = (r: number, c: number) => `v-${r}-${c}`;
const vertexKey = (r: number, c: number) => `vt-${r}-${c}`;
const plaquetteKey = (r: number, c: number) => `pl-${r}-${c}`;

type Op = "I" | "X" | "Z" | "Y";
type Tool = "X" | "Z" | "Y";
type DecoderType = "greedy" | "mwpm";
type PlayerMode = "solo" | "two_player" | "adversarial";

type Suggestion = {
  target: string;
  tool: "X" | "Z";
  defectType: "vertex" | "plaquette";
};

type GameState = {
  edges: Record<string, Op>;
  vertexDefects: Record<string, boolean>;
  plaquetteDefects: Record<string, boolean>;
  score: number;
  currentPlayer: 1 | 2;
  playerScores: { 1: number; 2: number };
  moveCount: number;
  adversarialStep: 0 | 1 | 2;
  gameOver: boolean;
  winner: string | null;
  lastMoveSummary: string;
  history: string[];
};

function makeInitialState(): GameState {
  return {
    edges: {},
    vertexDefects: {},
    plaquetteDefects: {},
    score: 0,
    currentPlayer: 1,
    playerScores: { 1: 0, 2: 0 },
    moveCount: 0,
    adversarialStep: 0,
    gameOver: false,
    winner: null,
    lastMoveSummary: "No moves yet.",
    history: ["Welcome to Decoder Duel."],
  };
}

function countTrue(obj: Record<string, boolean>) {
  return Object.values(obj).filter(Boolean).length;
}

function toggleOp(current: Op, tool: Tool): Op {
  const x = current === "X" || current === "Y";
  const z = current === "Z" || current === "Y";
  const nx = tool === "X" || tool === "Y" ? !x : x;
  const nz = tool === "Z" || tool === "Y" ? !z : z;
  if (nx && nz) return "Y";
  if (nx) return "X";
  if (nz) return "Z";
  return "I";
}

function parseVertexKey(key: string) {
  const [, r, c] = key.split("-");
  return { r: Number(r), c: Number(c) };
}

function parsePlaquetteKey(key: string) {
  const [, r, c] = key.split("-");
  return { r: Number(r), c: Number(c) };
}

function wrappedDelta(a: number, b: number, size: number) {
  const raw = b - a;
  const wrapped = raw > 0 ? raw - size : raw + size;
  return Math.abs(wrapped) < Math.abs(raw) ? wrapped : raw;
}

function buildVertexPath(start: string, end: string, torus: boolean): string[] {
  const { r: r1, c: c1 } = parseVertexKey(start);
  const { r: r2, c: c2 } = parseVertexKey(end);
  let r = r1;
  let c = c1;
  const path: string[] = [];
  const dr = torus ? wrappedDelta(r1, r2, N + 1) : r2 - r1;
  const dc = torus ? wrappedDelta(c1, c2, N + 1) : c2 - c1;

  for (let step = 0; step < Math.abs(dc); step++) {
    if (dc > 0) {
      path.push(edgeKeyH(r, c));
      c = torus ? (c + 1) % (N + 1) : c + 1;
    } else {
      const prevC = torus ? (c - 1 + (N + 1)) % (N + 1) : c - 1;
      path.push(edgeKeyH(r, prevC));
      c = prevC;
    }
  }

  for (let step = 0; step < Math.abs(dr); step++) {
    if (dr > 0) {
      path.push(edgeKeyV(r, c));
      r = torus ? (r + 1) % (N + 1) : r + 1;
    } else {
      const prevR = torus ? (r - 1 + (N + 1)) % (N + 1) : r - 1;
      path.push(edgeKeyV(prevR, c));
      r = prevR;
    }
  }

  return path;
}

function buildPlaquettePath(start: string, end: string, torus: boolean): string[] {
  const { r: r1, c: c1 } = parsePlaquetteKey(start);
  const { r: r2, c: c2 } = parsePlaquetteKey(end);
  let r = r1;
  let c = c1;
  const path: string[] = [];
  const dr = torus ? wrappedDelta(r1, r2, N) : r2 - r1;
  const dc = torus ? wrappedDelta(c1, c2, N) : c2 - c1;

  for (let step = 0; step < Math.abs(dc); step++) {
    if (dc > 0) {
      path.push(edgeKeyV(r, c + 1));
      c = torus ? (c + 1) % N : c + 1;
    } else {
      path.push(edgeKeyV(r, c));
      c = torus ? (c - 1 + N) % N : c - 1;
    }
  }

  for (let step = 0; step < Math.abs(dr); step++) {
    if (dr > 0) {
      path.push(edgeKeyH(r + 1, c));
      r = torus ? (r + 1) % N : r + 1;
    } else {
      path.push(edgeKeyH(r, c));
      r = torus ? (r - 1 + N) % N : r - 1;
    }
  }

  return path;
}

function greedyPairing(keys: string[], pathBuilder: (a: string, b: string) => string[]) {
  const remaining = [...keys];
  const pairs: Array<[string, string]> = [];
  while (remaining.length >= 2) {
    const first = remaining.shift()!;
    let bestIndex = 0;
    let bestLength = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const len = pathBuilder(first, remaining[i]).length;
      if (len < bestLength) {
        bestLength = len;
        bestIndex = i;
      }
    }
    const second = remaining.splice(bestIndex, 1)[0];
    pairs.push([first, second]);
  }
  return pairs;
}

function mwpmPairing(keys: string[], pathBuilder: (a: string, b: string) => string[]) {
  const memo = new Map<string, { cost: number; pairs: Array<[string, string]> }>();

  function solve(remaining: string[]): { cost: number; pairs: Array<[string, string]> } {
    if (remaining.length <= 1) return { cost: 0, pairs: [] };
    const sorted = [...remaining].sort();
    const memoKey = sorted.join("|");
    const cached = memo.get(memoKey);
    if (cached) return cached;

    const first = sorted[0];
    let best = { cost: Infinity, pairs: [] as Array<[string, string]> };
    for (let i = 1; i < sorted.length; i++) {
      const second = sorted[i];
      const pairCost = pathBuilder(first, second).length;
      const rest = sorted.filter((k) => k !== first && k !== second);
      const sub = solve(rest);
      const total = pairCost + sub.cost;
      if (total < best.cost) {
        best = { cost: total, pairs: [[first, second], ...sub.pairs] };
      }
    }

    memo.set(memoKey, best);
    return best;
  }

  return solve(keys).pairs;
}

function buildSuggestions(game: GameState, torus: boolean, decoderType: DecoderType): Suggestion[] {
  const vertexKeys = Object.entries(game.vertexDefects).filter(([, v]) => v).map(([k]) => k);
  const plaquetteKeys = Object.entries(game.plaquetteDefects).filter(([, v]) => v).map(([k]) => k);
  const pairFn = decoderType === "mwpm" ? mwpmPairing : greedyPairing;
  const suggestions: Suggestion[] = [];

  for (const [a, b] of pairFn(vertexKeys, (x, y) => buildVertexPath(x, y, torus))) {
    for (const edge of buildVertexPath(a, b, torus)) {
      suggestions.push({ target: edge, tool: "Z", defectType: "vertex" });
    }
  }
  for (const [a, b] of pairFn(plaquetteKeys, (x, y) => buildPlaquettePath(x, y, torus))) {
    for (const edge of buildPlaquettePath(a, b, torus)) {
      suggestions.push({ target: edge, tool: "X", defectType: "plaquette" });
    }
  }

  return suggestions;
}

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

function edgeColor(op: Op) {
  if (op === "X") return "#2563eb";
  if (op === "Z") return "#dc2626";
  if (op === "Y") return "#7c3aed";
  return "#94a3b8";
}

function applySingleMove(state: GameState, key: string, tool: Tool, playerMode: PlayerMode): GameState {
  const [kind, rs, cs] = key.split("-");
  const r = Number(rs);
  const c = Number(cs);

  const beforeVertexCount = countTrue(state.vertexDefects);
  const beforePlaquetteCount = countTrue(state.plaquetteDefects);

  const nextEdges = { ...state.edges, [key]: toggleOp(state.edges[key] ?? "I", tool) };
  const nextVertexDefects = { ...state.vertexDefects };
  const nextPlaquetteDefects = { ...state.plaquetteDefects };

  if (tool === "Z" || tool === "Y") {
    if (kind === "h") {
      nextVertexDefects[vertexKey(r, c)] = !nextVertexDefects[vertexKey(r, c)];
      nextVertexDefects[vertexKey(r, c + 1)] = !nextVertexDefects[vertexKey(r, c + 1)];
    } else {
      nextVertexDefects[vertexKey(r, c)] = !nextVertexDefects[vertexKey(r, c)];
      nextVertexDefects[vertexKey(r + 1, c)] = !nextVertexDefects[vertexKey(r + 1, c)];
    }
  }

  if (tool === "X" || tool === "Y") {
    if (kind === "h") {
      if (r > 0) nextPlaquetteDefects[plaquetteKey(r - 1, c)] = !nextPlaquetteDefects[plaquetteKey(r - 1, c)];
      if (r < N) nextPlaquetteDefects[plaquetteKey(r, c)] = !nextPlaquetteDefects[plaquetteKey(r, c)];
    } else {
      if (c > 0) nextPlaquetteDefects[plaquetteKey(r, c - 1)] = !nextPlaquetteDefects[plaquetteKey(r, c - 1)];
      if (c < N) nextPlaquetteDefects[plaquetteKey(r, c)] = !nextPlaquetteDefects[plaquetteKey(r, c)];
    }
  }

  const afterVertexCount = countTrue(nextVertexDefects);
  const afterPlaquetteCount = countTrue(nextPlaquetteDefects);
  const removedDefects = Math.max(0, beforeVertexCount + beforePlaquetteCount - afterVertexCount - afterPlaquetteCount);
  const createdDefects = Math.max(0, afterVertexCount + afterPlaquetteCount - beforeVertexCount - beforePlaquetteCount);
  const scoreDelta = 1 + removedDefects * 3;

  const nextMoveCount = state.moveCount + 1;
  let nextCurrentPlayer: 1 | 2 = playerMode === "solo" ? 1 : state.currentPlayer === 1 ? 2 : 1;
  let nextAdversarialStep: 0 | 1 | 2 = state.adversarialStep;
  const nextPlayerScores = { ...state.playerScores };

  if (playerMode === "two_player") {
    nextPlayerScores[state.currentPlayer] += scoreDelta;
  } else if (playerMode === "adversarial") {
    if (state.currentPlayer === 1) nextPlayerScores[1] += createdDefects;
    else nextPlayerScores[2] += removedDefects * 3;

    if (state.adversarialStep === 0) {
      nextCurrentPlayer = 1;
      nextAdversarialStep = 1;
    } else if (state.adversarialStep === 1) {
      nextCurrentPlayer = 2;
      nextAdversarialStep = 2;
    } else {
      nextCurrentPlayer = 1;
      nextAdversarialStep = 0;
    }
  }

  const totalDefects = afterVertexCount + afterPlaquetteCount;
  let gameOver = false;
  let winner: string | null = null;
  if (playerMode === "adversarial" && nextMoveCount >= 3) {
    if (state.currentPlayer === 2 && totalDefects === 0) {
      gameOver = true;
      winner = "P2 (Decoder wins!)";
    } else if (totalDefects >= 10) {
      gameOver = true;
      winner = "P1 (Overwhelmed with errors!)";
    }
  }

  const prefix = playerMode === "solo" ? "" : `P${state.currentPlayer}: `;
  const lastMoveSummary = `${prefix}${tool} on ${key}: +${scoreDelta} points, removed ${removedDefects}, created ${createdDefects}.`;

  return {
    edges: nextEdges,
    vertexDefects: nextVertexDefects,
    plaquetteDefects: nextPlaquetteDefects,
    score: state.score + scoreDelta,
    currentPlayer: nextCurrentPlayer,
    playerScores: nextPlayerScores,
    moveCount: nextMoveCount,
    adversarialStep: nextAdversarialStep,
    gameOver,
    winner,
    lastMoveSummary,
    history: [lastMoveSummary, ...state.history].slice(0, 10),
  };
}

export default function DecoderDuel() {
  const [tool, setTool] = useState<Tool>("Z");
  const [playerMode, setPlayerMode] = useState<PlayerMode>("solo");
  const [decoderType, setDecoderType] = useState<DecoderType>("greedy");
  const [torus, setTorus] = useState(false);
  const [showDecoder, setShowDecoder] = useState(false);
  const [showPaths, setShowPaths] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [game, setGame] = useState<GameState>(makeInitialState());

  const hEdges = useMemo(() => {
    const arr: Array<{ key: string; r: number; c: number }> = [];
    for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) arr.push({ key: edgeKeyH(r, c), r, c });
    return arr;
  }, []);

  const vEdges = useMemo(() => {
    const arr: Array<{ key: string; r: number; c: number }> = [];
    for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) arr.push({ key: edgeKeyV(r, c), r, c });
    return arr;
  }, []);

  const decoderSuggestions = useMemo(() => {
    if (!showDecoder) return [] as Suggestion[];
    return buildSuggestions(game, torus, decoderType);
  }, [showDecoder, game, torus, decoderType]);

  const suggestionMap = useMemo(() => {
    const map: Record<string, "X" | "Z"> = {};
    for (const step of decoderSuggestions) map[step.target] = step.tool;
    return map;
  }, [decoderSuggestions]);

  const vertexCount = countTrue(game.vertexDefects);
  const plaquetteCount = countTrue(game.plaquetteDefects);

  const applyMove = (key: string) => {
    if (game.gameOver) return;
    setShowDecoder(false);
    setGame((state) => applySingleMove(state, key, tool, playerMode));
  };

  const reset = () => {
    setGame(makeInitialState());
    setShowDecoder(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={panelStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Decoder Duel</h2>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
              Choose a mode, pick an operator, and play.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              <button style={smallButton(tool === "Z")} onClick={() => setTool("Z")}>Z</button>
              <button style={smallButton(tool === "X")} onClick={() => setTool("X")}>X</button>
              <button style={smallButton(tool === "Y")} onClick={() => setTool("Y")}>Y</button>
            </div>

            <div style={{ ...panelStyle(), boxShadow: "none", padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Mode</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <button style={smallButton(playerMode === "solo")} onClick={() => { setPlayerMode("solo"); setGame(makeInitialState()); setShowDecoder(false); }}>Solo</button>
                <button style={smallButton(playerMode === "two_player")} onClick={() => { setPlayerMode("two_player"); setGame(makeInitialState()); setShowDecoder(false); }}>Two player</button>
                <button style={smallButton(playerMode === "adversarial")} onClick={() => { setPlayerMode("adversarial"); setGame(makeInitialState()); setShowDecoder(false); }}>Adversarial</button>
              </div>
              {playerMode === "adversarial" && (
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                  P1 attacks twice, then P2 gets one decode move.
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <button style={smallButton(false)} onClick={reset}>Reset board</button>
              <button style={smallButton(false)} disabled={game.moveCount === 0} onClick={() => setShowDecoder((v) => !v)}>
                {showDecoder ? "Hide decoder" : "Show decoder"}
              </button>
            </div>

            <button style={{ ...smallButton(showHelp), width: "100%", marginTop: 12 }} onClick={() => setShowHelp((value) => !value)}>
              {showHelp ? "Hide help" : "Help"}
            </button>

            {showHelp && (
              <div style={{ ...panelStyle(), boxShadow: "none", padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>How to play</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
                  Try every mode to learn how Decoder Duel changes from puzzle-solving into competition.
                </div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>
                  <strong>Solo:</strong> practice placing X, Z, and Y operators at your own pace. Every move scores <code>1 + 3 x removed defects</code>, so closing defects is the fastest way to build score. Created defects are shown in the move log but do not subtract points.
                </div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>
                  <strong>Two player:</strong> players alternate turns on the same board. On your turn, you score <code>1 + 3 x removed defects</code>; adding defects does not directly cost points, but it changes the board for the next player. Compare P1 and P2 scores as the duel develops.
                </div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                  <strong>Adversarial:</strong> P1 attacks for two turns, then P2 decodes for one turn. In this mode, P1 scores from defects created, while P2 scores <code>3 x removed defects</code>. After the decode step, P2 wins by clearing all defects; P1 wins if the board reaches 10 or more total defects.
                </div>
              </div>
            )}

            <button style={{ ...smallButton(showSettings), width: "100%", marginTop: 12 }} onClick={() => setShowSettings((value) => !value)}>
              {showSettings ? "Hide settings" : "Settings"}
            </button>

            {showSettings && (
              <div style={{ ...panelStyle(), boxShadow: "none", padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Settings</div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Decoder type</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button style={smallButton(decoderType === "greedy")} onClick={() => setDecoderType("greedy")}>Greedy</button>
                    <button style={smallButton(decoderType === "mwpm")} onClick={() => setDecoderType("mwpm")}>Minimum weight matching</button>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Torus mode</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Wrap edges left-right and top-bottom</div>
                  </div>
                  <input type="checkbox" checked={torus} onChange={(e) => setTorus(e.target.checked)} />
                </label>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Show decoder paths</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Highlight suggested edges</div>
                  </div>
                  <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} />
                </label>
              </div>
            )}
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0 }}>Match</h3>
            <div>
              <span style={badgeStyle()}>Score: {game.score}</span>
              <span style={badgeStyle()}>Vertex defects: {vertexCount}</span>
              <span style={badgeStyle()}>Plaquette defects: {plaquetteCount}</span>
              {playerMode !== "solo" && <span style={badgeStyle()}>Current player: P{game.currentPlayer}</span>}
              {playerMode === "adversarial" && <span style={badgeStyle()}>Phase: {game.currentPlayer === 1 ? `Attack ${game.adversarialStep + 1}/2` : "Decode"}</span>}
            </div>
            {playerMode !== "solo" && (
              <div style={{ marginBottom: 8 }}>
                <span style={badgeStyle()}>P1 score: {game.playerScores[1]}</span>
                <span style={badgeStyle()}>P2 score: {game.playerScores[2]}</span>
              </div>
            )}
            <div style={{ color: "#475569", marginBottom: 8 }}>{game.lastMoveSummary}</div>
            <div style={{ color: "#475569", fontSize: 14 }}>Moves played: {game.moveCount}</div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              Decoder suggestions: {showDecoder ? decoderSuggestions.length : 0}
            </div>
            {game.gameOver && <div style={{ color: "#dc2626", fontWeight: 700, marginTop: 8 }}>Game Over: {game.winner}</div>}
          </div>

          {showDecoder && (
            <div style={panelStyle()}>
              <h3 style={{ marginTop: 0 }}>Decoder Queue</h3>
              {decoderSuggestions.length === 0 ? (
                <div style={{ color: "#64748b" }}>No suggestions right now.</div>
              ) : (
                decoderSuggestions.slice(0, 12).map((step, i) => (
                  <div key={`${step.target}-${i}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 8 }}>
                    Step {i + 1}: apply <strong>{step.tool}</strong> on <code>{step.target}</code>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0 }}>Recent Moves</h3>
            {game.history.slice(0, 6).map((line, i) => (
              <div key={`${line}-${i}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 8, color: "#334155", fontSize: 14 }}>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyle()}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Board</h2>
          <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
            Click edges to play with the selected operator. The board shows syndrome structure rather than the hidden full error history.
          </div>
          <div
            style={{
              position: "relative",
              width: 760,
              height: 760,
              maxWidth: "100%",
              aspectRatio: "1 / 1",
              border: "1px solid #dbe5f0",
              borderRadius: 24,
              background: "radial-gradient(circle at top, #ffffff 0%, #f8fafc 65%, #eef4fb 100%)",
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
            {Array.from({ length: N + 1 }).flatMap((_, r) =>
              Array.from({ length: N }).map((_, c) => (
                <div
                  key={`lattice-h-${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: `${10 + c * 20}%`,
                    top: `${10 + r * 20}%`,
                    width: "20%",
                    height: 2,
                    transform: "translateY(-50%)",
                    background: "rgba(148, 163, 184, 0.45)",
                    pointerEvents: "none",
                  }}
                />
              ))
            )}

            {Array.from({ length: N }).flatMap((_, r) =>
              Array.from({ length: N + 1 }).map((_, c) => (
                <div
                  key={`lattice-v-${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: `${10 + c * 20}%`,
                    top: `${10 + r * 20}%`,
                    width: 2,
                    height: "20%",
                    transform: "translateX(-50%)",
                    background: "rgba(148, 163, 184, 0.45)",
                    pointerEvents: "none",
                  }}
                />
              ))
            )}

            {Array.from({ length: N }).flatMap((_, r) =>
              Array.from({ length: N }).map((_, c) => {
                const key = plaquetteKey(r, c);
                const active = !!game.plaquetteDefects[key];
                return (
                  <div
                    key={key}
                    style={{
                      position: "absolute",
                      left: `${10 + c * 20}%`,
                      top: `${10 + r * 20}%`,
                      width: "18%",
                      height: "18%",
                      border: active ? "2px solid #16a34a" : "1px solid #cbd5e1",
                      background: active ? "rgba(187, 247, 208, 0.95)" : "rgba(241, 245, 249, 0.82)",
                      borderRadius: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: active ? "#166534" : "#64748b",
                      boxShadow: active ? "0 0 0 5px rgba(34, 197, 94, 0.18)" : "none",
                    }}
                  >
                    {active ? "B_p" : ""}
                  </div>
                );
              })
            )}

            {hEdges.map(({ key, r, c }) => {
              const op = game.edges[key] ?? "I";
              const suggestedTool = suggestionMap[key];
              return (
                <button
                  key={key}
                  onClick={() => applyMove(key)}
                  title={key}
                  style={{
                    position: "absolute",
                    left: `${20 + c * 20}%`,
                    top: `${10 + r * 20}%`,
                    width: 34,
                    height: 34,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: `2px solid ${op === "I" ? "#94a3b8" : edgeColor(op)}`,
                    color: op === "I" ? "#475569" : "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: op === "I" ? "rgba(255, 255, 255, 0.96)" : edgeColor(op),
                    outline: showDecoder && showPaths && suggestedTool ? `3px dashed ${suggestedTool === "Z" ? "#ef4444" : "#3b82f6"}` : "none",
                    outlineOffset: 2,
                    zIndex: op !== "I" ? 3 : 2,
                  }}
                >
                  {op === "I" ? "" : op}
                </button>
              );
            })}

            {vEdges.map(({ key, r, c }) => {
              const op = game.edges[key] ?? "I";
              const suggestedTool = suggestionMap[key];
              return (
                <button
                  key={key}
                  onClick={() => applyMove(key)}
                  title={key}
                  style={{
                    position: "absolute",
                    left: `${10 + c * 20}%`,
                    top: `${20 + r * 20}%`,
                    width: 34,
                    height: 34,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: `2px solid ${op === "I" ? "#94a3b8" : edgeColor(op)}`,
                    color: op === "I" ? "#475569" : "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: op === "I" ? "rgba(255, 255, 255, 0.96)" : edgeColor(op),
                    outline: showDecoder && showPaths && suggestedTool ? `3px dashed ${suggestedTool === "Z" ? "#ef4444" : "#3b82f6"}` : "none",
                    outlineOffset: 2,
                    zIndex: op !== "I" ? 3 : 2,
                  }}
                >
                  {op === "I" ? "" : op}
                </button>
              );
            })}

            {Array.from({ length: N + 1 }).flatMap((_, r) =>
              Array.from({ length: N + 1 }).map((_, c) => {
                const key = vertexKey(r, c);
                const active = !!game.vertexDefects[key];
                return (
                  <div
                    key={key}
                    style={{
                      position: "absolute",
                      left: `${10 + c * 20}%`,
                      top: `${10 + r * 20}%`,
                      width: 34,
                      height: 34,
                      transform: "translate(-50%, -50%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: active ? "#854d0e" : "#94a3b8",
                      fontSize: active ? 11 : 10,
                      fontWeight: 700,
                      lineHeight: 1,
                      background: active ? "rgba(254, 240, 138, 0.98)" : "transparent",
                      borderRadius: active ? "50%" : 0,
                      border: active ? "2px solid #f59e0b" : "none",
                      boxShadow: active ? "0 0 0 7px rgba(234, 179, 8, 0.26), 0 0 24px rgba(245, 158, 11, 0.35)" : "none",
                      pointerEvents: "none",
                      zIndex: active ? 5 : 1,
                    }}
                  >
                    {active ? "A_v" : "•"}
                  </div>
                );
              })
            )}

            {torus && (
              <div style={{ position: "absolute", inset: 10, border: "2px dashed #c4b5fd", borderRadius: 22, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: "50%", top: 5, transform: "translateX(-50%)", color: "#7c3aed", fontSize: 12 }}>periodic: top ↔ bottom</div>
                <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%) rotate(-90deg)", color: "#7c3aed", fontSize: 12 }}>periodic: left ↔ right</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
