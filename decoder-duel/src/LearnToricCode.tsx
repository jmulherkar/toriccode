import React, { useEffect, useMemo, useState } from "react";

const N = 4;

const edgeKeyH = (r: number, c: number) => `h-${r}-${c}`;
const edgeKeyV = (r: number, c: number) => `v-${r}-${c}`;
const vertexKey = (r: number, c: number) => `vt-${r}-${c}`;
const plaquetteKey = (r: number, c: number) => `pl-${r}-${c}`;

type Op = "I" | "X" | "Z" | "Y";
type Tool = "X" | "Z" | "Y";
type DecoderType = "greedy" | "mwpm";
type Scenario = "empty" | "single_z" | "mixed";
type InteractionMode = "focus" | "free" | "decoder_only";

type LearnState = {
  edges: Record<string, Op>;
  vertexDefects: Record<string, boolean>;
  plaquetteDefects: Record<string, boolean>;
  history: string[];
};

type Suggestion = {
  target: string;
  tool: "X" | "Z";
  defectType: "vertex" | "plaquette";
};

type QuizOption = {
  id: string;
  label: string;
  explanation: string;
};

type Quiz = {
  prompt: string;
  correct: string;
  options: QuizOption[];
};

type CourseStep = {
  id: string;
  title: string;
  headline: string;
  concept: string;
  task: string;
  hint: string;
  success: string;
  scenario: Scenario;
  defaultTool: Tool;
  allowedTools: Tool[];
  interactionMode: InteractionMode;
  focusEdges?: string[];
  torus: boolean;
  showDecoder: boolean;
  showLogicalX: boolean;
  showLogicalZ: boolean;
  formula?: string;
  visualTakeaway?: string;
  highlightVertices?: string[];
  highlightPlaquettes?: string[];
  quiz?: Quiz;
};

type CompletionContext = {
  state: LearnState;
  stepMoves: number;
  decoderActions: number;
  scenarioLoaded: boolean;
  everHadDefects: boolean;
  currentStep: CourseStep;
  quizPassed: boolean;
  logicalZLoop: string[];
};

function makeInitialState(message = "This question starts with a clear board. Use the prompt above to decide what to try."): LearnState {
  return {
    edges: {},
    vertexDefects: {},
    plaquetteDefects: {},
    history: [message],
  };
}

function panelStyle(): React.CSSProperties {
  return {
    background: "white",
    border: "1px solid #d7e1ea",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
  };
}

function smallButton(active: boolean, disabled = false): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${disabled ? "#cbd5e1" : active ? "#0f172a" : "#cbd5e1"}`,
    background: disabled ? "#f8fafc" : active ? "#0f172a" : "white",
    color: disabled ? "#94a3b8" : active ? "white" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.72 : 1,
  };
}

function badgeStyle(background = "#e2e8f0", color = "#0f172a"): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    marginRight: 8,
    marginBottom: 8,
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

function buildSuggestions(state: LearnState, torus: boolean, decoderType: DecoderType): Suggestion[] {
  const vertexKeys = Object.entries(state.vertexDefects)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const plaquetteKeys = Object.entries(state.plaquetteDefects)
    .filter(([, v]) => v)
    .map(([k]) => k);
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

function wrapIndex(value: number, size: number) {
  return ((value % size) + size) % size;
}

function toggleVertexDefect(nextVertexDefects: Record<string, boolean>, r: number, c: number, torus: boolean) {
  const row = torus ? wrapIndex(r, N) : r;
  const col = torus ? wrapIndex(c, N) : c;
  nextVertexDefects[vertexKey(row, col)] = !nextVertexDefects[vertexKey(row, col)];
}

function togglePlaquetteDefect(nextPlaquetteDefects: Record<string, boolean>, r: number, c: number, torus: boolean) {
  if (!torus && (r < 0 || r >= N || c < 0 || c >= N)) return;
  const row = torus ? wrapIndex(r, N) : r;
  const col = torus ? wrapIndex(c, N) : c;
  nextPlaquetteDefects[plaquetteKey(row, col)] = !nextPlaquetteDefects[plaquetteKey(row, col)];
}

function applyOperation(state: LearnState, key: string, tool: Tool, torus: boolean): LearnState {
  const [kind, rs, cs] = key.split("-");
  const r = Number(rs);
  const c = Number(cs);

  const nextEdges = { ...state.edges, [key]: toggleOp(state.edges[key] ?? "I", tool) };
  const nextVertexDefects = { ...state.vertexDefects };
  const nextPlaquetteDefects = { ...state.plaquetteDefects };

  if (tool === "Z" || tool === "Y") {
    if (kind === "h") {
      toggleVertexDefect(nextVertexDefects, r, c, torus);
      toggleVertexDefect(nextVertexDefects, r, c + 1, torus);
    } else {
      toggleVertexDefect(nextVertexDefects, r, c, torus);
      toggleVertexDefect(nextVertexDefects, r + 1, c, torus);
    }
  }

  if (tool === "X" || tool === "Y") {
    if (kind === "h") {
      togglePlaquetteDefect(nextPlaquetteDefects, r - 1, c, torus);
      togglePlaquetteDefect(nextPlaquetteDefects, r, c, torus);
    } else {
      togglePlaquetteDefect(nextPlaquetteDefects, r, c - 1, torus);
      togglePlaquetteDefect(nextPlaquetteDefects, r, c, torus);
    }
  }

  const nextHistory = [`Applied ${tool} on ${key}.`, ...state.history].slice(0, 10);

  return {
    edges: nextEdges,
    vertexDefects: nextVertexDefects,
    plaquetteDefects: nextPlaquetteDefects,
    history: nextHistory,
  };
}

function edgeColor(op: Op) {
  if (op === "X") return "#2563eb";
  if (op === "Z") return "#dc2626";
  if (op === "Y") return "#7c3aed";
  return "#94a3b8";
}

function createScenarioState(scenario: Scenario): LearnState {
  if (scenario === "single_z") {
    let next = makeInitialState("A one-edge Z string has been prepared for you.");
    next = applyOperation(next, edgeKeyH(2, 1), "Z", false);
    next.history = ["Prepared one Z segment. Extend it and watch the interior cancel.", ...next.history].slice(0, 10);
    return next;
  }

  if (scenario === "mixed") {
    let next = makeInitialState("A mixed syndrome pattern is ready for decoding.");
    next = applyOperation(next, edgeKeyH(1, 1), "Y", true);
    next = applyOperation(next, edgeKeyV(2, 3), "X", true);
    next = applyOperation(next, edgeKeyH(3, 2), "Z", true);
    next.history = ["Loaded a mixed error pattern. Use the decoder to suggest a recovery path.", ...next.history].slice(0, 10);
    return next;
  }

  return makeInitialState();
}

function allEdgesMatch(state: LearnState, edges: string[], op: Op) {
  return edges.every((edge) => (state.edges[edge] ?? "I") === op);
}

function hasAnyTwoEdgeZString(state: LearnState) {
  for (let r = 0; r <= N; r += 1) {
    for (let c = 0; c < N - 1; c += 1) {
      if (allEdgesMatch(state, [edgeKeyH(r, c), edgeKeyH(r, c + 1)], "Z")) return true;
    }
  }

  for (let r = 0; r < N - 1; r += 1) {
    for (let c = 0; c <= N; c += 1) {
      if (allEdgesMatch(state, [edgeKeyV(r, c), edgeKeyV(r + 1, c)], "Z")) return true;
    }
  }

  return false;
}

function hasAnyPlaquetteZLoop(state: LearnState) {
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (
        allEdgesMatch(
          state,
          [edgeKeyH(r, c), edgeKeyV(r, c), edgeKeyH(r + 1, c), edgeKeyV(r, c + 1)],
          "Z",
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function latestActionSummary(
  historyLine: string | undefined,
  vertexCount: number,
  plaquetteCount: number,
) {
  if (!historyLine) {
    return "The board starts clear for each question. Use the prompt above to decide what to test, and this panel will interpret your latest move.";
  }

  const match = historyLine.match(/^Applied ([XYZ]) on /);
  if (!match) {
    return historyLine;
  }

  const appliedTool = match[1] as Tool;

  if (appliedTool === "Z" && vertexCount === 2 && plaquetteCount === 0) {
    return "Your latest Z move produced the expected star-channel syndrome: two vertex defects and no plaquette defects.";
  }

  if (appliedTool === "X" && vertexCount === 0 && plaquetteCount === 2) {
    return "Your latest X move produced the expected plaquette-channel syndrome: two plaquette defects and no vertex defects.";
  }

  if (appliedTool === "Y" && vertexCount === 2 && plaquetteCount === 2) {
    return "Your latest Y move lit up both channels at once, which is exactly the combined X-and-Z syndrome picture.";
  }

  if (vertexCount === 0 && plaquetteCount === 0) {
    return "Your latest move left no visible syndrome. That usually means boundaries canceled, as in a closed loop or a reversed step.";
  }

  return `Your latest ${appliedTool} move leaves ${vertexCount} vertex defect(s) and ${plaquetteCount} plaquette defect(s) on the board.`;
}

function stepIsComplete(context: CompletionContext) {
  const { state, stepMoves, decoderActions, scenarioLoaded, everHadDefects, currentStep, quizPassed, logicalZLoop } = context;
  const vertexCount = countTrue(state.vertexDefects);
  const plaquetteCount = countTrue(state.plaquetteDefects);

  switch (currentStep.id) {
    case "stabilizer-intro":
    case "qubits-on-edges":
    case "stars-vs-plaquettes":
    case "commuting-intro":
    case "commuting-star-plaquette":
    case "commuting-same-family":
    case "star-check-intro":
    case "plaquette-check-intro":
    case "string-intro":
    case "loop-intro":
    case "torus-intro":
    case "decoder-intro":
    case "decoder-ambiguity":
      return quizPassed;
    case "star-check":
      return quizPassed && stepMoves >= 1 && vertexCount === 2 && plaquetteCount === 0;
    case "plaquette-check":
      return quizPassed && stepMoves >= 1 && vertexCount === 0 && plaquetteCount === 2;
    case "y-error":
      return stepMoves >= 1 && vertexCount === 2 && plaquetteCount === 2;
    case "string":
      return hasAnyTwoEdgeZString(state) && vertexCount === 2;
    case "loop":
      return hasAnyPlaquetteZLoop(state) && vertexCount === 0;
    case "logical":
      return quizPassed && allEdgesMatch(state, logicalZLoop, "Z") && vertexCount === 0;
    case "decoder":
      return decoderActions >= 1;
    case "capstone":
      return scenarioLoaded && everHadDefects && vertexCount + plaquetteCount === 0;
    default:
      return false;
  }
}

type LearnToricCodeProps = {
  initialStepId?: string;
  moduleTitle?: string;
  moduleSubtitle?: string;
};

export default function LearnToricCode({
  initialStepId = "stabilizer-intro",
  moduleTitle = "Learn Toric Code",
  moduleSubtitle = "A slow, interactive path from stabilizer intuition to topology-aware decoding.",
}: LearnToricCodeProps) {
  const logicalZLoop = useMemo(() => Array.from({ length: N }, (_, c) => edgeKeyH(Math.floor(N / 2), c)), []);

  const courseSteps = useMemo<CourseStep[]>(
    () => [
      {
        id: "stabilizer-intro",
        title: "1. Local Checks",
        headline: "The code is defined by local checks",
        concept: "In the stabilizer formalism, we do not describe the toric code by listing every amplitude. Instead, we describe the allowed states by the commuting checks they satisfy. Star checks are X-type operators on the four edges touching a vertex, and plaquette checks are Z-type operators on the four edges around a face. Later, X and Z edge errors will disturb different check families, but the code space itself is defined by all of these local constraints together.",
        task: "Use the empty board as a map: look at the highlighted star and plaquette operators before answering the opening question.",
        hint: "Read the board as a map of constraints: yellow stars are X-type checks, green plaquettes are Z-type checks, and X or Z edge errors will later show up by violating one of these families.",
        success: "You’ve got the central viewpoint in place: the toric code is a lattice of stabilizer constraints.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 1)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "A_v = product of X on the four incident edges,   B_p = product of Z on the four boundary edges",
        visualTakeaway: "The highlighted edges are the qubits multiplied together by one stabilizer generator.",
        highlightVertices: [vertexKey(2, 2)],
        highlightPlaquettes: [plaquetteKey(1, 1)],
        quiz: {
          prompt: "In this app, what do the star and plaquette markers represent before we start applying X or Z errors?",
          correct: "checks",
          options: [
            { id: "checks", label: "Local stabilizer checks", explanation: "Right. They are the commuting X-type and Z-type operators that define the code space." },
            { id: "qubits", label: "Physical qubits", explanation: "The physical qubits live on the edges, not on the stars or plaquettes." },
            { id: "decoder-paths", label: "Decoder path markers", explanation: "Decoder paths appear later. These markers are the checks the decoder reads out." },
          ],
        },
      },
      {
        id: "qubits-on-edges",
        title: "2. Qubits On Edges",
        headline: "The data qubits live on the lattice edges",
        concept: "The toric code uses the lattice in a very specific way. Vertices and plaquettes are not qubits. They are where we read the stabilizer checks. The actual physical qubits live on the edges between them.",
        task: "On the empty board, compare the edge qubits with the vertex and plaquette operators before answering.",
        hint: "Ask which objects can actually carry X, Z, or Y faults in this picture, and which ones only measure them.",
        success: "You’ve separated the data qubits from the places where the syndrome is measured.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 1)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        highlightVertices: [vertexKey(2, 2)],
        highlightPlaquettes: [plaquetteKey(1, 1)],
        quiz: {
          prompt: "Where are the physical qubits in this lattice model?",
          correct: "edges",
          options: [
            { id: "edges", label: "On the edges", explanation: "Right. The edges carry the qubits, while vertices and plaquettes host the checks." },
            { id: "vertices", label: "On the vertices", explanation: "Not in this toric-code layout. Vertices mark one family of stabilizer checks." },
            { id: "plaquettes", label: "Inside the plaquettes", explanation: "Not here. Plaquettes are where the Z-type checks are measured." },
          ],
        },
      },
      {
        id: "stars-vs-plaquettes",
        title: "3. Two Check Families",
        headline: "Stars and plaquettes play different stabilizer roles",
        concept: "The toric code uses two complementary families of local checks. Star checks are X-type operators associated with vertices. Plaquette checks are Z-type operators associated with faces. Together they define the protected code space.",
        task: "On the empty board, compare one star and one plaquette operator, then answer the check.",
        hint: "Yellow and green markers are not decorative. They stand for different Pauli-type checks acting on different local edge sets.",
        success: "You’ve got the two stabilizer families straight before we start injecting errors.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["X", "Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 1), edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "A_v uses X operators on edges meeting at a vertex, while B_p uses Z operators on edges around a plaquette",
        highlightVertices: [vertexKey(2, 2)],
        highlightPlaquettes: [plaquetteKey(1, 1)],
        quiz: {
          prompt: "Which statement best matches the toric code checks in this lesson?",
          correct: "x-z-families",
          options: [
            { id: "x-z-families", label: "Stars are X-type checks and plaquettes are Z-type checks", explanation: "Correct. That is the core local stabilizer structure of the toric code." },
            { id: "same-type", label: "Stars and plaquettes are both the same kind of check", explanation: "No. The point is that the code uses two complementary Pauli-type check families." },
            { id: "logical-only", label: "Stars and plaquettes are logical operators, not stabilizers", explanation: "No. They are local stabilizer generators." },
          ],
        },
      },
      {
        id: "commuting-intro",
        title: "4. Why The Checks Can Coexist",
        headline: "The toric-code stabilizers commute with each other",
        concept: "A quantum code cannot be defined by incompatible measurements. The toric code works because its local star and plaquette operators commute, so the code space can be the shared +1 eigenspace of all of them at once.",
        task: "Use the empty board to inspect a highlighted star and plaquette pair, then answer why the code needs them to commute.",
        hint: "A good way to check is to look at where the two operators overlap on the board and ask whether they could produce an odd or even number of XZ sign flips.",
        success: "You’ve connected commutation to the existence of one consistent toric-code subspace.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(1, 1), edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "[A_v, B_p] = 0 for all star and plaquette generators in the toric code",
        visualTakeaway: "The highlighted local checks are not fighting each other. They are compatible constraints on the same encoded state.",
        highlightVertices: [vertexKey(2, 2)],
        highlightPlaquettes: [plaquetteKey(1, 1)],
        quiz: {
          prompt: "Why is it important that toric-code stabilizer generators commute?",
          correct: "shared-code-space",
          options: [
            { id: "shared-code-space", label: "So they can define one shared code space together", explanation: "Correct. Commuting checks can be measured consistently and share a joint eigenspace." },
            { id: "faster-decoder", label: "So the decoder runs faster on the lattice", explanation: "No. The main reason is physical and algebraic compatibility, not decoder speed." },
            { id: "more-qubits", label: "So the code can place more qubits on the edges", explanation: "No. Edge placement is geometric; commutation is about compatible stabilizer measurements." },
          ],
        },
      },
      {
        id: "commuting-star-plaquette",
        title: "5. Star-Plaquette Commutation",
        headline: "A star and a plaquette commute because their overlap is even",
        concept: "A neighboring star and plaquette do not usually overlap on just one edge. On the square lattice they either do not overlap at all, or they share two edges. Each shared edge contributes one XZ anticommutation, and two minus signs cancel to give overall commutation.",
        task: "On the empty board, inspect the highlighted star and plaquette and count how many edge qubits they share before answering.",
        hint: "A practical check is: count the shared edge qubits. One shared XZ pair would anticommute, but two shared XZ pairs give two sign flips, which multiply back to +1.",
        success: "You’ve seen the key local reason that star and plaquette operators commute on the toric lattice.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["X", "Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(1, 1), edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "Two shared XZ anticommutations => (-1) x (-1) = +1",
        visualTakeaway: "The board highlights the even-overlap geometry that makes a star and neighboring plaquette compatible checks.",
        highlightVertices: [vertexKey(1, 2)],
        highlightPlaquettes: [plaquetteKey(1, 1)],
        quiz: {
          prompt: "Why does a star operator commute with a neighboring plaquette operator?",
          correct: "two-overlaps",
          options: [
            { id: "two-overlaps", label: "Because they overlap on two edges, so the two anticommutations cancel", explanation: "Exactly. The even number of shared XZ pairs makes the overall sign come back to +1." },
            { id: "same-pauli", label: "Because both operators use the same Pauli on every shared qubit", explanation: "No. The star is X-type and the plaquette is Z-type on shared edges." },
            { id: "decoder-fixes", label: "Because the decoder enforces commutation after measurement", explanation: "No. The operators commute as part of the code definition before any decoder is involved." },
          ],
        },
      },
      {
        id: "commuting-same-family",
        title: "6. Same-Family Checks Also Commute",
        headline: "Stars commute with stars, and plaquettes commute with plaquettes",
        concept: "Checks in the same family are even simpler. Two stars only use X operators, and two plaquettes only use Z operators. Whether they are disjoint or share an edge, they still commute because there is no mixed XZ conflict on the overlap.",
        task: "Use the empty board to compare two nearby checks from the same family, then answer the check.",
        hint: "A practical check is to ask what Pauli type each operator uses on any shared edge. Same-type overlap does not create an anticommutation sign flip.",
        success: "You’ve completed the commutation picture: same-family checks commute directly, and star-plaquette pairs commute by even overlap.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["X", "Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 1), edgeKeyV(2, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "Why do two star operators commute with each other?",
          correct: "same-pauli-family",
          options: [
            { id: "same-pauli-family", label: "Because they use the same Pauli type on any shared edge", explanation: "Correct. Shared X with X commutes, just as shared Z with Z commutes for plaquettes." },
            { id: "never-overlap", label: "Because two stars never share an edge", explanation: "Not always. Neighboring stars can share one edge, but they still commute." },
            { id: "logical-loop", label: "Because all star operators are actually logical loops", explanation: "No. Stars are local stabilizer generators, not logical loops." },
          ],
        },
      },
      {
        id: "star-check-intro",
        title: "7. Z Errors And Star Checks",
        headline: "A Z error shows up in the star channel",
        concept: "A star stabilizer is X-type. A Z on one edge anticommutes with the two star checks that touch that edge, so those two measurement outcomes flip from +1 to -1.",
        task: "Starting from the empty board, try a Z error anywhere and watch which vertex checks react before answering.",
        hint: "The crucial local rule is X versus Z anticommutation on the same qubit.",
        success: "You’ve connected a single Z fault to the star-check syndrome channel.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "free",
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "A Z edge error flips the two neighboring X-type star checks",
        visualTakeaway: "A local fault is seen through the checks it anticommutes with, not by directly reading out the hidden state.",
        highlightVertices: [vertexKey(1, 1), vertexKey(1, 2)],
        quiz: {
          prompt: "Why do nearby star checks react to a Z error on one edge?",
          correct: "anticommutes",
          options: [
            { id: "anticommutes", label: "Because the Z error anticommutes with the X-type star checks that touch that edge", explanation: "Exactly. The sign flips because the local Pauli operators anticommute." },
            { id: "same-pauli", label: "Because the star checks are also Z operators", explanation: "No. Star checks are X-type in this picture." },
            { id: "decoder", label: "Because the decoder marks those stars for us", explanation: "No. The syndrome appears before any decoder is used." },
          ],
        },
      },
      {
        id: "star-check",
        title: "8. Make The Star Syndrome Appear",
        headline: "A single Z creates a pair of vertex defects",
        concept: "Now we use the board directly. Any single local Z on an edge should create two nearby yellow star defects and leave the plaquette channel quiet.",
        task: "Place a Z on any edge and check that exactly two vertex defects appear.",
        hint: "Only the two star checks sharing the chosen edge should flip. You should not see green plaquette defects here.",
        success: "You’ve seen the star-channel syndrome on the board, not just in words.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "free",
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "Z anticommutes with the neighboring X-type star checks, so those measurement signs flip",
        visualTakeaway: "The yellow pair is the footprint of one violated stabilizer family, not a direct picture of the hidden quantum state.",
        highlightVertices: [vertexKey(1, 1), vertexKey(1, 2)],
      },
      {
        id: "plaquette-check-intro",
        title: "9. X Errors And Plaquette Checks",
        headline: "An X error shows up in the plaquette channel",
        concept: "The toric code has a complementary syndrome story. A plaquette stabilizer is Z-type, so an X on one edge flips the neighboring plaquette checks instead of the star checks.",
        task: "Starting from the empty board, try an X error anywhere and watch which plaquette checks react before answering.",
        hint: "This is the dual of the previous step: now it is X versus Z anticommutation that matters.",
        success: "You’ve connected the other local Pauli channel to the plaquette syndrome picture.",
        scenario: "empty",
        defaultTool: "X",
        allowedTools: ["X"],
        interactionMode: "free",
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "An X edge error flips the two neighboring Z-type plaquette checks",
        visualTakeaway: "The toric code diagnoses X and Z faults through different stabilizer families.",
        highlightPlaquettes: [plaquetteKey(1, 1), plaquetteKey(1, 2)],
        quiz: {
          prompt: "Which stabilizer family reacts to a single X fault on one edge?",
          correct: "plaquettes",
          options: [
            { id: "plaquettes", label: "The neighboring plaquette checks", explanation: "Correct. X anticommutes with the Z-type plaquette stabilizers that touch that edge." },
            { id: "stars", label: "The neighboring star checks", explanation: "That is the Z-error pattern, not the X-error pattern." },
            { id: "both", label: "Both star and plaquette checks equally", explanation: "Not for a pure X fault. That broader response is associated with Y." },
          ],
        },
      },
      {
        id: "plaquette-check",
        title: "10. Make The Plaquette Syndrome Appear",
        headline: "An X on one edge flips adjacent plaquette outcomes",
        concept: "A plaquette stabilizer is a Z-type operator around one face. An X error anticommutes with the neighboring plaquette checks, so those faces report a nontrivial syndrome. This is the dual channel to the star-check story.",
        task: "Place an X on any edge and check that exactly two green plaquette defects appear.",
        hint: "The same visual rule applies: one edge error is seen through the local checks that touch it and anticommute with it.",
        success: "You’ve now seen both stabilizer channels that the toric code uses for detection.",
        scenario: "empty",
        defaultTool: "X",
        allowedTools: ["X"],
        interactionMode: "free",
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "X anticommutes with the neighboring Z-type plaquette checks, so those measurement signs flip",
        visualTakeaway: "Green plaquette defects are violated Z-type stabilizers, just as yellow vertex defects are violated X-type stabilizers.",
        highlightPlaquettes: [plaquetteKey(1, 1), plaquetteKey(1, 2)],
      },
      {
        id: "y-error",
        title: "11. Y Touches Both Channels",
        headline: "Y combines the X and Z syndrome stories",
        concept: "The Pauli operator Y combines X and Z behavior. On the lattice, that means a single Y fault excites both the vertex-defect and plaquette-defect channels at once.",
        task: "Apply a Y on the highlighted edge and compare both defect families at the same time.",
        hint: "Think of Y as carrying both X-like and Z-like effects locally.",
        success: "You’ve linked Pauli algebra to the combined syndrome picture on the lattice.",
        scenario: "empty",
        defaultTool: "Y",
        allowedTools: ["Y"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
      },
      {
        id: "string-intro",
        title: "12. Strings Create Boundaries",
        headline: "The syndrome only sees the ends of a string",
        concept: "A longer Z string does not create a defect at every edge. Instead, adjacent interior checks cancel in pairs, so only the endpoints remain visible in the star syndrome.",
        task: "Starting from the clear board, draw a short Z string and compare its visible defects with the hidden interior before answering.",
        hint: "Try placing Z on two adjacent edges. The board begins empty here, so the defect pattern you see is entirely the boundary of the string you create.",
        success: "You’re ready to read defect pairs as string endpoints rather than isolated accidents.",
        scenario: "single_z",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "Interior syndrome cancellations leave only the boundary of a string visible",
        quiz: {
          prompt: "What does the toric-code syndrome reveal about a short string error?",
          correct: "boundary",
          options: [
            { id: "boundary", label: "Its boundary endpoints, not every interior edge", explanation: "Correct. The syndrome marks where the string begins and ends as seen by violated checks." },
            { id: "full-path", label: "The full path of every edge in the string", explanation: "No. The interior is largely hidden by stabilizer cancellations." },
            { id: "logical-value", label: "The encoded logical bit directly", explanation: "No. The syndrome reveals check violations, not the logical state." },
          ],
        },
      },
      {
        id: "string",
        title: "13. Extend A String",
        headline: "Strings hide their interior",
        concept: "Now you can watch the boundary picture happen. Extending a Z string by one more edge should move an endpoint rather than leave a visible defect in the interior.",
        task: "Starting from the clear board, build a short Z string on the highlighted path and watch the interior cancel while the endpoint moves.",
        hint: "Place Z on two adjacent highlighted edges. The important visual change is that the shared interior defect disappears while the outer endpoints remain.",
        success: "You’ve seen a boundary move without turning the entire string into visible syndrome.",
        scenario: "single_z",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
      },
      {
        id: "loop-intro",
        title: "14. Closed Loops Have No Boundary",
        headline: "A contractible loop can erase its own syndrome",
        concept: "If a string closes into a small loop, it has no endpoints. In stabilizer language, a contractible closed loop is built from local checks and therefore creates no syndrome even though several edges are involved.",
        task: "Starting from the empty board, try closing a small Z loop and watch what happens to the syndrome before answering.",
        hint: "No boundary means no visible defect endpoints to mark. You can test that by completing a little square loop.",
        success: "You’ve connected the absence of syndrome to the closed-loop picture.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(1, 1), edgeKeyV(1, 1), edgeKeyH(2, 1), edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "Contractible closed loops are stabilizer-generated and therefore syndrome-free",
        quiz: {
          prompt: "Why can a small contractible loop create no visible syndrome?",
          correct: "no-boundary",
          options: [
            { id: "no-boundary", label: "Because the loop has no boundary endpoints left over", explanation: "Correct. Without endpoints, the local syndrome cancels away." },
            { id: "wrong-tool", label: "Because loops are not made from Pauli operators", explanation: "No. The loop is still made from edge Pauli operations." },
            { id: "decoder-hides", label: "Because the decoder automatically hides the defects", explanation: "No. The absence of syndrome is a property of the loop itself." },
          ],
        },
      },
      {
        id: "loop",
        title: "15. Build A Contractible Loop",
        headline: "A small loop is locally invisible",
        concept: "Build the little four-edge Z loop and watch the vertex defects disappear entirely. This is the board-level version of a contractible stabilizer loop.",
        task: "Draw the highlighted four-edge Z loop and verify that the vertex syndrome returns to zero.",
        hint: "You are closing a path, not extending it. The final edge should erase the remaining boundary.",
        success: "You just built a contractible loop with no visible boundary syndrome.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(1, 1), edgeKeyV(1, 1), edgeKeyH(2, 1), edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
      },
      {
        id: "torus-intro",
        title: "16. Wrapping Changes The Story",
        headline: "On a torus, some closed loops cannot shrink away",
        concept: "When opposite boundaries are identified, the lattice becomes topologically different. A loop that wraps all the way around the torus has no local boundary, yet it may still act nontrivially on the encoded information.",
        task: "Use the empty torus board and the highlighted logical directions to think about wrapped loops before answering.",
        hint: "The key new idea is that 'no syndrome' does not always mean 'trivial action.' A wrapped loop can still matter logically.",
        success: "You’re ready to separate local invisibility from logical triviality.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [logicalZLoop[0], logicalZLoop[1]],
        torus: true,
        showDecoder: false,
        showLogicalX: true,
        showLogicalZ: true,
        quiz: {
          prompt: "What changes when we move from a planar patch to a torus?",
          correct: "noncontractible",
          options: [
            { id: "noncontractible", label: "Some closed loops can wrap around and fail to contract to a point", explanation: "Correct. Those wrapped loops are the topological feature that matters here." },
            { id: "no-stabilizers", label: "The stabilizer checks disappear", explanation: "No. The toric code still has local star and plaquette checks." },
            { id: "qubits-move", label: "The qubits move off the edges", explanation: "No. The geometric placement of qubits on edges stays the same in this model." },
          ],
        },
      },
      {
        id: "logical",
        title: "17. Non-Contractible Loops Are Logical",
        headline: "A wrapped loop can preserve the syndrome but still matter logically",
        concept: "A Z loop around the torus can commute with the stabilizers and create no local defects, yet still act nontrivially on the encoded space. This is the topological origin of logical operators in the toric code.",
        task: "Answer the question, then complete the highlighted non-contractible Z loop.",
        hint: "Compare this to the earlier small loop. Both can be syndrome-free, but only one wraps around the torus.",
        success: "You’ve seen the distinction between a harmless local loop and a logical loop around the torus.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: logicalZLoop,
        torus: true,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: true,
        quiz: {
          prompt: "Why is a non-contractible loop logically important even when the syndrome is zero?",
          correct: "changes-encoded",
          options: [
            { id: "changes-encoded", label: "Because it can act nontrivially on the encoded state while remaining locally syndrome-free", explanation: "Exactly. This is the topological logical-operator idea." },
            { id: "hidden-pauli", label: "Because it secretly changes X into Z on every edge", explanation: "No. The issue is topological action on the code space, not a hidden Pauli-type conversion." },
            { id: "decoder-only", label: "Because the decoder labels it logical by convention", explanation: "No. Its logical significance comes from the torus topology itself." },
          ],
        },
      },
      {
        id: "decoder-intro",
        title: "18. What The Decoder Sees",
        headline: "The decoder works from the syndrome, not the hidden state",
        concept: "Error correction in the toric code starts from the observed defect pattern. The decoder sees violated checks, pairs them, and proposes recovery strings without ever directly accessing the encoded logical information.",
        task: "Starting from the clear board, think about what information a decoder would get after errors create defects, then answer.",
        hint: "Even though the board begins empty, the decoder's job is still defined by the defect pattern and code geometry, not the exact historical error path or the hidden logical state.",
        success: "You’ve got the right starting point for understanding toric-code decoding.",
        scenario: "mixed",
        defaultTool: "Z",
        allowedTools: [],
        interactionMode: "decoder_only",
        torus: true,
        showDecoder: true,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "What information does the decoder fundamentally use here?",
          correct: "syndrome",
          options: [
            { id: "syndrome", label: "The observed syndrome defects and the code geometry", explanation: "Correct. The decoder uses the measured defect pattern to infer a likely recovery." },
            { id: "true-error", label: "The exact original error string", explanation: "No. If we knew that directly, decoding would not be necessary." },
            { id: "logical-state", label: "The hidden logical qubit value", explanation: "No. Directly measuring the logical state would defeat the point of error correction." },
          ],
        },
      },
      {
        id: "decoder",
        title: "19. Apply A Decoder Step",
        headline: "A decoder proposes a recovery path from the defects",
        concept: "Now the decoder suggestions are visible. The proposed moves connect syndrome defects in a way that is consistent with the chosen decoding rule, such as greedy pairing or minimum-weight matching.",
        task: "Starting from the clear board, load the mixed case and apply at least one suggested decoder step.",
        hint: "The board begins empty for this question, so load the mixed case below first. You are still following a recovery hypothesis built from the defect pattern, not the hidden original error.",
        success: "You’ve connected the abstract decoding idea to a concrete suggested recovery path starting from a freshly cleared board.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["X", "Z", "Y"],
        interactionMode: "decoder_only",
        torus: true,
        showDecoder: true,
        showLogicalX: false,
        showLogicalZ: false,
      },
      {
        id: "decoder-ambiguity",
        title: "20. Decoding Can Be Ambiguous",
        headline: "Different recovery paths can agree locally but differ topologically",
        concept: "Two candidate recovery strings can remove the same visible syndrome while differing by a closed loop. On a torus, that difference can be logically harmless or logically disastrous depending on the homology class.",
        task: "Use the clear board and your loop intuition to think about two different recoveries, then answer the harder decoding question.",
        hint: "Ask whether two recoveries that clear the same defects must always be equivalent in the encoded space, or whether they can differ by a non-contractible loop.",
        success: "You’ve reached the deeper toric-code idea: decoding is about the right homology class, not just clearing local defects.",
        scenario: "mixed",
        defaultTool: "Z",
        allowedTools: [],
        interactionMode: "decoder_only",
        torus: true,
        showDecoder: true,
        showLogicalX: true,
        showLogicalZ: true,
        quiz: {
          prompt: "Why can two recovery paths that remove the same defects still behave differently logically?",
          correct: "homology",
          options: [
            { id: "homology", label: "Because they can differ by a non-contractible loop and therefore act differently on the encoded state", explanation: "Correct. Clearing the local syndrome is not the whole story on a torus." },
            { id: "same-always", label: "Because all successful recoveries are always logically identical", explanation: "No. That is exactly what topology can prevent." },
            { id: "color-only", label: "Because one path may use a different color marker in the UI", explanation: "No. The important difference is topological, not cosmetic." },
          ],
        },
      },
      {
        id: "capstone",
        title: "21. Capstone Lab",
        headline: "Decode a full configuration yourself",
        concept: "This final lab combines the whole lesson: local checks detect violated symmetries, strings create boundary syndromes, loops may be trivial or logical depending on topology, and a decoder must choose a recovery class from incomplete information.",
        task: "Load a scenario and remove all defects using manual moves, the decoder, or both.",
        hint: "Try the mixed case first. Ask not only whether the syndrome disappears, but whether your recovery differs from the fault by a harmless contractible loop or a logical cycle.",
        success: "You completed the toric-code module and reached an open-ended decoding lab.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["X", "Z", "Y"],
        interactionMode: "free",
        torus: true,
        showDecoder: true,
        showLogicalX: true,
        showLogicalZ: true,
      },
    ],
    [logicalZLoop],
  );

  const initialStepIndex = useMemo(() => {
    const index = courseSteps.findIndex((step) => step.id === initialStepId);
    return index >= 0 ? index : 0;
  }, [courseSteps, initialStepId]);

  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [tool, setTool] = useState<Tool>("Z");
  const [torus, setTorus] = useState(false);
  const [showDecoder, setShowDecoder] = useState(false);
  const [decoderType, setDecoderType] = useState<DecoderType>("mwpm");
  const [state, setState] = useState<LearnState>(makeInitialState());
  const [stepMoves, setStepMoves] = useState(0);
  const [decoderActions, setDecoderActions] = useState(0);
  const [scenarioLoaded, setScenarioLoaded] = useState(false);
  const [everHadDefects, setEverHadDefects] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});

  const currentStep = courseSteps[stepIndex];

  useEffect(() => {
    setStepIndex(initialStepIndex);
  }, [initialStepIndex]);

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

  useEffect(() => {
    setTool(currentStep.defaultTool);
    setTorus(currentStep.torus);
    setShowDecoder(currentStep.showDecoder);
    setState(makeInitialState());
    setStepMoves(0);
    setDecoderActions(0);
    setScenarioLoaded(false);
    setEverHadDefects(false);
  }, [currentStep]);

  const decoderSuggestions = useMemo(() => {
    if (!showDecoder) return [] as Suggestion[];
    return buildSuggestions(state, torus, decoderType);
  }, [showDecoder, state, torus, decoderType]);

  const suggestionMap = useMemo(() => {
    const map: Record<string, "X" | "Z"> = {};
    for (const step of decoderSuggestions) map[step.target] = step.tool;
    return map;
  }, [decoderSuggestions]);

  const vertexCount = countTrue(state.vertexDefects);
  const plaquetteCount = countTrue(state.plaquetteDefects);
  const totalDefects = vertexCount + plaquetteCount;
  const quizAnswer = quizAnswers[currentStep.id];
  const quizPassed = !currentStep.quiz || quizAnswer === currentStep.quiz.correct;

  useEffect(() => {
    if (totalDefects > 0) setEverHadDefects(true);
  }, [totalDefects]);

  const currentStepComplete = stepIsComplete({
    state,
    stepMoves,
    decoderActions,
    scenarioLoaded,
    everHadDefects,
    currentStep,
    quizPassed,
    logicalZLoop,
  });

  const completedSteps = courseSteps.filter((_, index) =>
    index < stepIndex ||
    (index === stepIndex &&
      currentStepComplete),
  ).length;

  const applyMove = (key: string) => {
    setStepMoves((value) => value + 1);
    setState((prev) => applyOperation(prev, key, tool, torus));
  };

  const applyFirstSuggestion = () => {
    if (decoderSuggestions.length === 0) return;
    const first = decoderSuggestions[0];
    setDecoderActions((value) => value + 1);
    setState((prev) => {
      const next = applyOperation(prev, first.target, first.tool, torus);
      return {
        ...next,
        history: [`Applied the first decoder step: ${first.tool} on ${first.target}.`, ...next.history].slice(0, 10),
      };
    });
  };

  const loadScenario = (scenario: Scenario) => {
    if (scenario === "empty") return;
    setState(createScenarioState(scenario));
    setScenarioLoaded(true);
    setEverHadDefects(true);
    setStepMoves(0);
    setDecoderActions(0);
  };

  const resetCurrentStep = () => {
    setTool(currentStep.defaultTool);
    setTorus(currentStep.torus);
    setShowDecoder(currentStep.showDecoder);
    setState(makeInitialState());
    setStepMoves(0);
    setDecoderActions(0);
    setScenarioLoaded(false);
    setEverHadDefects(false);
  };

  const quizFeedback = currentStep.quiz?.options.find((option) => option.id === quizAnswer)?.explanation;
  const progressPercent = (completedSteps / courseSteps.length) * 100;
  const boardFeedback = latestActionSummary(state.history[0], vertexCount, plaquetteCount);
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #dff7f1 0%, transparent 30%), linear-gradient(180deg, #f7fbff 0%, #eef4fb 52%, #e6edf7 100%)",
        padding: 24,
        fontFamily: "Avenir Next, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            ...panelStyle(),
            padding: 24,
            background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,248,255,0.94) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              marginBottom: 18,
            }}
          >
            <div style={{ maxWidth: 680 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#0f766e", textTransform: "uppercase", marginBottom: 8 }}>
                Guided Module
              </div>
              <h1 style={{ margin: "0 0 8px", fontSize: 34, color: "#0f172a" }}>{moduleTitle}</h1>
              <p style={{ margin: 0, color: "#475569", fontSize: 15, lineHeight: 1.6 }}>{moduleSubtitle}</p>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 8 }}>Progress</div>
              <div style={{ height: 12, borderRadius: 999, background: "#dbeafe", overflow: "hidden", marginBottom: 10 }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0f766e 0%, #2563eb 100%)",
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                {completedSteps} of {courseSteps.length} steps complete
              </div>
            </div>
          </div>

        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(420px, 0.9fr) minmax(680px, 1.15fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ ...panelStyle(), padding: 28 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <div style={badgeStyle("#ccfbf1", "#115e59")}>Step {stepIndex + 1}</div>
                <div style={badgeStyle("#e0e7ff", "#3730a3")}>{currentStepComplete ? "Completed" : "In progress"}</div>
                <div style={badgeStyle(torus ? "#ede9fe" : "#e2e8f0", torus ? "#6d28d9" : "#334155")}>
                  {torus ? "Torus mode" : "Planar patch"}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", marginBottom: 8 }}>
                {currentStep.title}
              </div>
              <h2 style={{ margin: "0 0 14px", fontSize: 32, lineHeight: 1.15, color: "#0f172a" }}>
                {currentStep.headline}
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.75, color: "#334155" }}>
                {currentStep.concept}
              </p>

              {currentStep.quiz && (
                <div style={{ marginTop: 22 }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 20, color: "#0f172a" }}>Concept check</h3>
                  <div style={{ fontSize: 15, color: "#0f172a", marginBottom: 12 }}>{currentStep.quiz.prompt}</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {currentStep.quiz.options.map((option) => {
                      const selected = quizAnswer === option.id;
                      const correct = currentStep.quiz?.correct === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [currentStep.id]: option.id }))}
                          style={{
                            padding: "14px 16px",
                            borderRadius: 16,
                            border: `1px solid ${selected ? (correct ? "#16a34a" : "#fb923c") : "#cbd5e1"}`,
                            background: selected ? (correct ? "#f0fdf4" : "#fff7ed") : "white",
                            textAlign: "left",
                            cursor: "pointer",
                            fontWeight: 600,
                            color: "#0f172a",
                            lineHeight: 1.5,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: quizPassed ? "#166534" : "#7c2d12" }}>
                    {quizFeedback ?? "Pick an answer before moving on."}
                  </div>
                </div>
              )}

              {!currentStep.quiz && (
                <div
                  style={{
                    marginTop: 22,
                    padding: 18,
                    borderRadius: 18,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  This step is completed by working in the lattice lab below.
                </div>
              )}

              <div
                style={{
                  marginTop: 22,
                  padding: 18,
                  borderRadius: 18,
                  background: currentStepComplete ? "#dcfce7" : "#f8fafc",
                  border: `1px solid ${currentStepComplete ? "#86efac" : "#dbe5f0"}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 6 }}>Takeaway</div>
                <div style={{ fontSize: 14, lineHeight: 1.65, color: currentStepComplete ? "#166534" : "#475569" }}>
                  {currentStepComplete
                    ? currentStep.success
                    : "Finish the current check or lattice action to unlock the next step."}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    style={smallButton(false, stepIndex === 0)}
                    onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                    disabled={stepIndex === 0}
                  >
                    Previous
                  </button>
                  <button style={smallButton(false)} onClick={resetCurrentStep}>
                    Reset step
                  </button>
                </div>

                <button
                  style={smallButton(currentStepComplete, !currentStepComplete || stepIndex === courseSteps.length - 1)}
                  onClick={() => setStepIndex((value) => Math.min(courseSteps.length - 1, value + 1))}
                  disabled={!currentStepComplete || stepIndex === courseSteps.length - 1}
                >
                  {stepIndex === courseSteps.length - 1 ? "Lesson complete" : "Continue"}
                </button>
              </div>
            </div>

            <div style={panelStyle()}>
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 700, color: "#0f172a" }}>Need a hint or formula?</summary>
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div style={{ border: "1px solid #dbe5f0", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 6 }}>Hint</div>
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: "#334155" }}>{currentStep.hint}</div>
                  </div>
                  {currentStep.formula && (
                    <div style={{ border: "1px solid #ddd6fe", borderRadius: 18, padding: 16, background: "#f5f3ff" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9", marginBottom: 6 }}>Key formula</div>
                      <div style={{ fontSize: 14, lineHeight: 1.65, color: "#4c1d95" }}>{currentStep.formula}</div>
                    </div>
                  )}
                  {currentStep.visualTakeaway && (
                    <div style={{ border: "1px solid #bae6fd", borderRadius: 18, padding: 16, background: "#f0f9ff" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}>Visual takeaway</div>
                      <div style={{ fontSize: 14, lineHeight: 1.65, color: "#334155" }}>{currentStep.visualTakeaway}</div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={panelStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Interactive Lattice Lab</h2>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    Each question starts with a clear board. Follow the written prompt above, then use the board to test the idea.
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...badgeStyle(showDecoder ? "#dbeafe" : "#e2e8f0", showDecoder ? "#1d4ed8" : "#334155"), marginRight: 0 }}>
                    {showDecoder ? `${decoderType.toUpperCase()} visible` : "Decoder hidden"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 16,
                  background: currentStep.allowedTools.length > 0 ? "#fff7ed" : "#f8fafc",
                  border: `1px solid ${currentStep.allowedTools.length > 0 ? "#fed7aa" : "#dbe5f0"}`,
                  color: currentStep.allowedTools.length > 0 ? "#9a3412" : "#475569",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <strong>Active board mode:</strong> {currentStep.task}{" "}
                {currentStep.interactionMode === "decoder_only"
                  ? "Use the decoder action below and watch the proposed recovery update the lattice."
                  : "The board is fully open, so you can test the idea anywhere on the lattice."}
              </div>

              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 16,
                  background: "#f8fbff",
                  border: "1px solid #dbe5f0",
                  color: "#334155",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <strong>Board hint:</strong> {currentStep.hint}
              </div>

              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 900,
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
              )),
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
              )),
            )}

            {Array.from({ length: N }).flatMap((_, r) =>
              Array.from({ length: N }).map((_, c) => {
                const key = plaquetteKey(r, c);
                const active = !!state.plaquetteDefects[key];
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
                      background: active
                        ? "rgba(187, 247, 208, 0.95)"
                        : "rgba(241, 245, 249, 0.82)",
                      borderRadius: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: active ? "#166534" : "#64748b",
                      boxShadow: active
                        ? "0 0 0 5px rgba(34, 197, 94, 0.18)"
                          : "none",
                    }}
                  >
                    {active ? "B_p" : ""}
                  </div>
                );
              }),
            )}

            {hEdges.map(({ key, r, c }) => {
              const op = state.edges[key] ?? "I";
              const suggestedTool = suggestionMap[key];
              const clickable = true;
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
                    cursor: clickable ? "pointer" : "default",
                    background: op === "I" ? "rgba(255, 255, 255, 0.96)" : edgeColor(op),
                    outline:
                      showDecoder && suggestedTool
                        ? `3px dashed ${suggestedTool === "Z" ? "#dc2626" : "#2563eb"}`
                        : "none",
                    boxShadow: "none",
                    opacity: 1,
                    outlineOffset: 2,
                    zIndex: op !== "I" ? 3 : 2,
                  }}
                >
                  {op === "I" ? "" : op}
                </button>
              );
            })}

            {vEdges.map(({ key, r, c }) => {
              const op = state.edges[key] ?? "I";
              const suggestedTool = suggestionMap[key];
              const clickable = true;
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
                    cursor: clickable ? "pointer" : "default",
                    background: op === "I" ? "rgba(255, 255, 255, 0.96)" : edgeColor(op),
                    outline:
                      showDecoder && suggestedTool
                        ? `3px dashed ${suggestedTool === "Z" ? "#dc2626" : "#2563eb"}`
                        : "none",
                    boxShadow: "none",
                    opacity: 1,
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
                const active = !!state.vertexDefects[key];
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
                      background: active
                        ? "rgba(254, 240, 138, 0.98)"
                        : "transparent",
                      borderRadius: active ? "50%" : 0,
                      border: active
                        ? "2px solid #f59e0b"
                          : "none",
                      boxShadow: active
                        ? "0 0 0 7px rgba(234, 179, 8, 0.26), 0 0 24px rgba(245, 158, 11, 0.35)"
                          : "none",
                      pointerEvents: "none",
                      zIndex: active ? 5 : 1,
                    }}
                  >
                    {active ? "A_v" : "•"}
                  </div>
                );
              }),
            )}

            {torus && (
              <div style={{ position: "absolute", inset: 10, border: "2px dashed #c4b5fd", borderRadius: 22, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: "50%", top: 5, transform: "translateX(-50%)", color: "#7c3aed", fontSize: 12 }}>
                  periodic: top ↔ bottom
                </div>
                <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%) rotate(-90deg)", color: "#7c3aed", fontSize: 12 }}>
                  periodic: left ↔ right
                </div>
              </div>
            )}
              </div>
            </div>

            <div style={panelStyle()}>
              <h3 style={{ margin: "0 0 10px", color: "#0f172a" }}>Basic controls</h3>
              <div style={{ marginBottom: 12 }}>
                <span style={badgeStyle("#fef3c7", "#92400e")}>Vertex defects: {vertexCount}</span>
                <span style={badgeStyle("#dcfce7", "#166534")}>Plaquette defects: {plaquetteCount}</span>
                <span style={badgeStyle("#e0e7ff", "#3730a3")}>Moves: {stepMoves}</span>
              </div>

              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
                Pick a tool, then click any edge on the board. All guidance for the question is given in the text panels.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {(["Z", "X", "Y"] as Tool[]).map((candidate) => (
                  <button
                    key={candidate}
                    style={smallButton(tool === candidate)}
                    onClick={() => setTool(candidate)}
                  >
                    {candidate}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <span style={badgeStyle("#eff6ff", "#1d4ed8")}>Current tool: {tool}</span>
                <span style={badgeStyle("#fff7ed", "#9a3412")}>Clickable edges: full board</span>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid #dbe5f0",
                  background: "#f8fafc",
                  fontSize: 13,
                  color: "#334155",
                  lineHeight: 1.6,
                  marginBottom: showDecoder || currentStep.id === "capstone" ? 12 : 0,
                }}
              >
                {boardFeedback}
              </div>

              {showDecoder && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <button style={smallButton(decoderType === "greedy")} onClick={() => setDecoderType("greedy")}>
                      Greedy
                    </button>
                    <button style={smallButton(decoderType === "mwpm")} onClick={() => setDecoderType("mwpm")}>
                      MWPM
                    </button>
                    <button
                      style={smallButton(false, decoderSuggestions.length === 0)}
                      onClick={applyFirstSuggestion}
                      disabled={decoderSuggestions.length === 0}
                    >
                      Apply first step
                    </button>
                  </div>

                  {decoderSuggestions.length > 0 && (
                    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                      Next suggestion: <strong>{decoderSuggestions[0].tool}</strong> on <code>{decoderSuggestions[0].target}</code>.
                    </div>
                  )}
                </>
              )}

              {(currentStep.id === "decoder" || currentStep.id === "capstone") && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {currentStep.id === "capstone" && (
                    <button style={smallButton(false)} onClick={() => loadScenario("single_z")}>
                      Load string
                    </button>
                  )}
                  <button style={smallButton(false)} onClick={() => loadScenario("mixed")}>
                    Load mixed case
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
