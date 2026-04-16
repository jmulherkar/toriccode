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

function makeInitialState(message = "Follow the guided prompt to learn one idea at a time."): LearnState {
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
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
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

function vertexSupportEdges(key: string) {
  const { r, c } = parseVertexKey(key);
  const edges: string[] = [];
  if (c > 0) edges.push(edgeKeyH(r, c - 1));
  if (c < N) edges.push(edgeKeyH(r, c));
  if (r > 0) edges.push(edgeKeyV(r - 1, c));
  if (r < N) edges.push(edgeKeyV(r, c));
  return edges;
}

function plaquetteSupportEdges(key: string) {
  const { r, c } = parsePlaquetteKey(key);
  return [edgeKeyH(r, c), edgeKeyV(r, c), edgeKeyH(r + 1, c), edgeKeyV(r, c + 1)];
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

function stepIsComplete(context: CompletionContext) {
  const { state, stepMoves, decoderActions, scenarioLoaded, everHadDefects, currentStep, quizPassed, logicalZLoop } = context;
  const vertexCount = countTrue(state.vertexDefects);
  const plaquetteCount = countTrue(state.plaquetteDefects);

  switch (currentStep.id) {
    case "stabilizer-intro":
      return quizPassed;
    case "star-check":
      return quizPassed && stepMoves >= 1 && vertexCount === 2 && plaquetteCount === 0;
    case "plaquette-check":
      return quizPassed && stepMoves >= 1 && vertexCount === 0 && plaquetteCount === 2;
    case "intro":
      return quizPassed && stepMoves >= 1;
    case "z-error":
      return quizPassed && stepMoves >= 1 && vertexCount === 2 && plaquetteCount === 0;
    case "x-error":
      return quizPassed && stepMoves >= 1 && vertexCount === 0 && plaquetteCount === 2;
    case "y-error":
      return stepMoves >= 1 && vertexCount === 2 && plaquetteCount === 2;
    case "string":
      return quizPassed && allEdgesMatch(state, [edgeKeyH(2, 1), edgeKeyH(2, 2)], "Z") && vertexCount === 2;
    case "loop":
      return allEdgesMatch(state, [edgeKeyH(1, 1), edgeKeyV(1, 1), edgeKeyH(2, 1), edgeKeyV(1, 2)], "Z") && vertexCount === 0;
    case "logical":
      return quizPassed && allEdgesMatch(state, logicalZLoop, "Z") && vertexCount === 0;
    case "decoder":
      return quizPassed && decoderActions >= 1;
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
  const logicalXLoop = useMemo(() => Array.from({ length: N }, (_, r) => edgeKeyV(r, Math.floor(N / 2))), []);

  const courseSteps = useMemo<CourseStep[]>(
    () => [
      {
        id: "stabilizer-intro",
        title: "1. Stabilizers First",
        headline: "The code is defined by local checks",
        concept: "In the stabilizer formalism, we do not describe the toric code by listing every amplitude. Instead, we describe the allowed states by the commuting checks they satisfy. Star checks are X-type operators on the four edges touching a vertex, and plaquette checks are Z-type operators on the four edges around a face.",
        task: "Answer the concept check, then inspect the highlighted star and plaquette supports on the board.",
        hint: "Read the board as a map of constraints: yellow stars are X-type checks, green plaquettes are Z-type checks, and the code space is where all of them return +1.",
        success: "You’ve got the central viewpoint in place: the toric code is a lattice of stabilizer constraints.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: [],
        interactionMode: "focus",
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "A_v = product of X on the four incident edges,   B_p = product of Z on the four boundary edges",
        visualTakeaway: "The highlighted edges are not random geometry. They are the qubits multiplied together by one stabilizer generator.",
        highlightVertices: [vertexKey(2, 2)],
        highlightPlaquettes: [plaquetteKey(1, 1)],
        quiz: {
          prompt: "In this app, what do the star and plaquette markers represent?",
          correct: "checks",
          options: [
            { id: "checks", label: "Local stabilizer checks", explanation: "Right. They are the commuting X-type and Z-type operators that define the code space." },
            { id: "qubits", label: "Physical qubits", explanation: "The physical qubits live on the edges, not on the stars or plaquettes." },
            { id: "decoder-paths", label: "Decoder path markers", explanation: "Decoder paths are suggested later. These markers are the checks the decoder reads out." },
          ],
        },
      },
      {
        id: "star-check",
        title: "2. Star Checks React to Z Errors",
        headline: "A Z on one edge flips adjacent star outcomes",
        concept: "A star stabilizer is an X-type operator. A Z error anticommutes with X on the same qubit, so the star checks touching that edge flip from +1 to -1. This is the stabilizer explanation behind the yellow defect pair.",
        task: "Answer the check, then place a Z on the highlighted edge and watch the neighboring star syndromes appear.",
        hint: "Only the two star checks that share that edge should react. The plaquette channel stays quiet here.",
        success: "You’ve linked the visible syndrome pattern to the stabilizer rule behind it.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(1, 1)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "Z anticommutes with the neighboring X-type star checks, so those measurement signs flip",
        visualTakeaway: "The yellow pair is the footprint of one violated stabilizer family, not a direct picture of the hidden quantum state.",
        highlightVertices: [vertexKey(1, 1), vertexKey(1, 2)],
        quiz: {
          prompt: "Why do the two nearby star checks flip after a Z error on one edge?",
          correct: "anticommutes",
          options: [
            { id: "anticommutes", label: "Because Z anticommutes with those X-type checks", explanation: "Exactly. The star generators touching that edge change sign because the local Pauli operators anticommute." },
            { id: "same-pauli", label: "Because they use the same Z operator", explanation: "Not here. The star checks are X-type, which is why Z disturbs them." },
            { id: "decoder", label: "Because the decoder chooses them", explanation: "The syndrome appears before any decoder acts. It comes from the stabilizer measurements themselves." },
          ],
        },
      },
      {
        id: "plaquette-check",
        title: "3. Plaquette Checks React to X Errors",
        headline: "An X on one edge flips adjacent plaquette outcomes",
        concept: "A plaquette stabilizer is a Z-type operator around one face. An X error anticommutes with the neighboring plaquette checks, so those faces report a nontrivial syndrome. This is the dual channel to the star-check story.",
        task: "Answer the check, then place an X on the highlighted edge and look for the two green plaquette defects.",
        hint: "The same visual rule applies: one edge error is seen through the local checks that touch it and anticommute with it.",
        success: "You’ve now seen both stabilizer channels that the toric code uses for detection.",
        scenario: "empty",
        defaultTool: "X",
        allowedTools: ["X"],
        interactionMode: "focus",
        focusEdges: [edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        formula: "X anticommutes with the neighboring Z-type plaquette checks, so those measurement signs flip",
        visualTakeaway: "Green plaquette defects are violated Z-type stabilizers, just as yellow vertex defects are violated X-type stabilizers.",
        highlightPlaquettes: [plaquetteKey(1, 1), plaquetteKey(1, 2)],
        quiz: {
          prompt: "What is the green plaquette pair really showing you?",
          correct: "violated-z",
          options: [
            { id: "violated-z", label: "Two violated Z-type stabilizers", explanation: "Correct. The plaquette syndromes are the measured checks that changed sign." },
            { id: "x-string", label: "The full X string itself", explanation: "Not directly. The stabilizer readout only exposes the boundary syndrome." },
            { id: "logical-loop", label: "A logical operator", explanation: "A single local X error is detectable and not a logical loop by itself." },
          ],
        },
      },
      {
        id: "intro",
        title: "4. Lattice Orientation",
        headline: "Qubits live on edges",
        concept: "In the stabilizer formalism, we describe the code through commuting multi-qubit Pauli checks. The data qubits sit on edges, while the vertices and plaquettes track the code's local symmetries.",
        task: "Answer the quick check, then click the glowing edge once.",
        hint: "This follows the lattice picture from the toric-code notes: edges carry qubits, and nearby checks report whether a local symmetry has been disturbed.",
        success: "You have the basic geometry in place: qubits on edges, symmetry checks around them.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 1)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "Where does the toric code place its physical qubits in this lattice view?",
          correct: "edges",
          options: [
            { id: "edges", label: "On the edges", explanation: "Right. The code is described by checks on vertices and plaquettes, but the physical qubits themselves live on edges." },
            { id: "vertices", label: "On the vertices", explanation: "Not in this toric-code layout. Vertices host one family of stabilizer checks." },
            { id: "plaquettes", label: "At the center of plaquettes", explanation: "Not here. Plaquettes host the other family of stabilizer checks." },
          ],
        },
      },
      {
        id: "z-error",
        title: "5. Z Error Syndromes",
        headline: "A Z error flips nearby vertex checks",
        concept: "Error detection comes from measuring symmetries of the state rather than individual qubits. A single Z fault anticommutes with the adjacent X-type vertex checks, so their measurement outcomes flip.",
        task: "Answer the check, then apply a Z on the highlighted edge and inspect the yellow endpoints.",
        hint: "Look for a pair of -1 syndrome outcomes on the neighboring vertex checks, with no plaquette response.",
        success: "You’ve seen how a local Z error shows up through nearby symmetry measurements.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(1, 1)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "Which checks flip sign when you place a Z on one edge in this simulator?",
          correct: "vertex",
          options: [
            { id: "vertex", label: "The adjacent vertex checks", explanation: "Correct. The Z error anticommutes with the X-type vertex or star checks that touch that edge." },
            { id: "plaquette", label: "The adjacent plaquette checks", explanation: "That is the complementary pattern for X-type faults in this model." },
            { id: "both", label: "Both kinds of checks", explanation: "Only a Y fault triggers both syndrome channels here." },
          ],
        },
      },
      {
        id: "x-error",
        title: "6. X Error Syndromes",
        headline: "An X error flips nearby plaquette checks",
        concept: "The complementary detection channel now appears. An X fault anticommutes with the neighboring Z-type plaquette checks, so the syndrome moves onto faces instead of vertices.",
        task: "Answer the check, then apply an X on the glowing edge and look for the green plaquette pair.",
        hint: "This is the dual picture from the surface-code viewpoint: the face checks, not the vertex checks, should flip.",
        success: "You’ve separated the two basic syndrome channels used throughout the stabilizer formalism.",
        scenario: "empty",
        defaultTool: "X",
        allowedTools: ["X"],
        interactionMode: "focus",
        focusEdges: [edgeKeyV(1, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "What should you expect after one isolated X error?",
          correct: "plaquette-pair",
          options: [
            { id: "plaquette-pair", label: "Two plaquette defects", explanation: "Exactly. The neighboring plaquette checks acquire the nontrivial syndrome." },
            { id: "vertex-pair", label: "Two vertex defects", explanation: "That is the signature of a Z fault, not an X fault, in this picture." },
            { id: "none", label: "No visible defect", explanation: "A single isolated X error is detectable by the stabilizer checks." },
          ],
        },
      },
      {
        id: "y-error",
        title: "7. Y Combines Both Channels",
        headline: "Y carries X and Z together",
        concept: "The Pauli operators form the language of the code, and Y combines the effects of X and Z. In syndrome language, that means one local Y fault excites both the vertex and plaquette channels at once.",
        task: "Apply a Y on the highlighted edge and compare both defect types at once.",
        hint: "This is the visible version of the Pauli-group rule Y ~ XZ: both kinds of local checks respond.",
        success: "You’ve connected Pauli algebra to the combined syndrome picture used in the notes.",
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
        id: "string",
        title: "8. Strings Hide Their Interior",
        headline: "Only string endpoints stay visible",
        concept: "Products of local Pauli errors form string operators. In the homological picture emphasized in the toric-code notes, the interior check flips cancel pairwise, so only the boundary of the string remains visible.",
        task: "Answer the check, then extend the prepared red string by clicking the second glowing edge.",
        hint: "Watch the shared middle vertex: once the string continues through it, the two flips cancel and only the endpoints remain.",
        success: "That is the core topological-code picture: the syndrome reveals the boundary, not the whole error chain.",
        scenario: "single_z",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: [edgeKeyH(2, 2)],
        torus: false,
        showDecoder: false,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "When you extend a Z string by one more adjacent edge, what happens to the shared middle defect?",
          correct: "cancel",
          options: [
            { id: "cancel", label: "It cancels out", explanation: "Right. The shared check is flipped twice, so the interior syndrome disappears and only the boundary remains." },
            { id: "double", label: "It doubles in strength", explanation: "The syndrome is a parity signal, so a second flip cancels the first rather than strengthening it." },
            { id: "moves-to-face", label: "It moves to a plaquette", explanation: "The defect does not change type here; the interior vertex excitation simply cancels." },
          ],
        },
      },
      {
        id: "loop",
        title: "9. Closed Loops Are Stabilizers",
        headline: "Contractible loops leave no syndrome",
        concept: "A contractible closed loop can be built from local stabilizer generators. Because it has no boundary, it creates no syndrome even though it is assembled from many local edge operations.",
        task: "Paint the four glowing edges with Z to close a small loop around one plaquette.",
        hint: "Each edge flips two nearby checks, but a closed contractible loop leaves every touched vertex with even parity.",
        success: "You just built a contractible stabilizer loop with no detectable boundary.",
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
        id: "logical",
        title: "10. Topology Creates Logical Qubits",
        headline: "A non-contractible loop acts logically",
        concept: "On a torus, some closed loops are non-contractible. Browne's notes frame these global cycles as the origin of encoded qubits: they preserve all local checks while acting nontrivially on the logical subspace.",
        task: "Answer the check, then paint the full red loop across the torus.",
        hint: "Because the boundaries are identified, the loop closes through the periodic wrap and cannot be shrunk to a point.",
        success: "You’ve reached the topological idea behind logical operators: no local syndrome, but a nontrivial global action.",
        scenario: "empty",
        defaultTool: "Z",
        allowedTools: ["Z"],
        interactionMode: "focus",
        focusEdges: logicalZLoop,
        torus: true,
        showDecoder: false,
        showLogicalX: true,
        showLogicalZ: true,
        quiz: {
          prompt: "Why is this torus-spanning loop different from the small loop in the previous step?",
          correct: "non-contractible",
          options: [
            { id: "non-contractible", label: "It cannot shrink to a point", explanation: "Exactly. The loop's homology class, not its local appearance, is what lets it act as a logical operator." },
            { id: "more-edges", label: "It uses more edges", explanation: "Length is not the key point. A longer contractible loop would still be topologically trivial." },
            { id: "contains-y", label: "It secretly contains Y operators", explanation: "No. The difference is topological, not a hidden change in Pauli type." },
          ],
        },
      },
      {
        id: "decoder",
        title: "11. Decoding Uses the Syndrome Only",
        headline: "A decoder pairs defects and proposes recovery strings",
        concept: "Error correction is inferred from syndrome data alone. The decoder sees where the local checks were violated, proposes a recovery string, and hopes that its homology class matches the original fault.",
        task: "Answer the check, then apply the first suggested decoder step.",
        hint: "This mirrors the notes: we do not measure the encoded state directly. We only read out the syndrome and infer a likely correction.",
        success: "You’ve connected symmetry measurements to an actual decoding rule.",
        scenario: "mixed",
        defaultTool: "Z",
        allowedTools: ["X", "Z", "Y"],
        interactionMode: "decoder_only",
        torus: true,
        showDecoder: true,
        showLogicalX: false,
        showLogicalZ: false,
        quiz: {
          prompt: "What information is the decoder using here?",
          correct: "syndrome",
          options: [
            { id: "syndrome", label: "Only the syndrome defects", explanation: "Correct. The decoder only gets the stabilizer outcomes and must infer a likely recovery chain from them." },
            { id: "true-error", label: "The exact original error", explanation: "That information is not available experimentally; otherwise there would be nothing to decode." },
            { id: "logical-state", label: "The hidden logical qubit value", explanation: "We avoid directly measuring the logical state because that would destroy the encoded information." },
          ],
        },
      },
      {
        id: "capstone",
        title: "12. Capstone Lab",
        headline: "Decode a full configuration yourself",
        concept: "This final lab combines the main thread of both PDFs: stabilizer checks detect violated symmetries, strings connect the observed boundaries, and topology decides whether a recovery is harmless or logically nontrivial.",
        task: "Load any scenario, then remove all defects using manual moves, the decoder, or both.",
        hint: "Try the mixed case first. Compare the suggested recovery strings and ask whether they differ only locally or by a non-contractible cycle.",
        success: "You completed the guided module and reached an open-ended topological decoding lab.",
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
  const [showLogicalX, setShowLogicalX] = useState(false);
  const [showLogicalZ, setShowLogicalZ] = useState(false);
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
    setShowLogicalX(currentStep.showLogicalX);
    setShowLogicalZ(currentStep.showLogicalZ);
    setState(createScenarioState(currentStep.scenario));
    setStepMoves(0);
    setDecoderActions(0);
    setScenarioLoaded(currentStep.scenario !== "empty");
    setEverHadDefects(currentStep.scenario !== "empty");
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

  const focusEdgeSet = new Set(currentStep.focusEdges ?? []);
  const highlightedVertexSet = new Set(currentStep.highlightVertices ?? []);
  const highlightedPlaquetteSet = new Set(currentStep.highlightPlaquettes ?? []);
  const highlightedSupportEdges = new Set([
    ...(currentStep.highlightVertices ?? []).flatMap(vertexSupportEdges),
    ...(currentStep.highlightPlaquettes ?? []).flatMap(plaquetteSupportEdges),
  ]);

  const edgeLocked = (key: string) => {
    if (currentStep.allowedTools.length === 0) return true;
    if (currentStep.interactionMode === "decoder_only") return true;
    if (currentStep.interactionMode === "focus") return !focusEdgeSet.has(key);
    return false;
  };

  const applyMove = (key: string) => {
    if (edgeLocked(key)) return;
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

  const applyAllSuggestions = () => {
    if (decoderSuggestions.length === 0) return;
    setDecoderActions((value) => value + decoderSuggestions.length);
    let next = { ...state, history: [...state.history] };
    for (const step of decoderSuggestions) {
      next = applyOperation(next, step.target, step.tool, torus);
    }
    next.history = [`Applied ${decoderSuggestions.length} decoder step(s).`, ...next.history].slice(0, 10);
    setState(next);
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
    setShowLogicalX(currentStep.showLogicalX);
    setShowLogicalZ(currentStep.showLogicalZ);
    setState(createScenarioState(currentStep.scenario));
    setStepMoves(0);
    setDecoderActions(0);
    setScenarioLoaded(currentStep.scenario !== "empty");
    setEverHadDefects(currentStep.scenario !== "empty");
  };

  const quizFeedback = currentStep.quiz?.options.find((option) => option.id === quizAnswer)?.explanation;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f4f7fb 0%, #e8eef7 100%)",
        padding: 24,
        fontFamily: "Avenir Next, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "380px 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...panelStyle(), background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#0f766e", textTransform: "uppercase" }}>
              Guided Module
            </div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 30 }}>{moduleTitle}</h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
              {moduleSubtitle}
            </p>

            <div style={{ marginTop: 14, marginBottom: 10, height: 10, borderRadius: 999, background: "#dbeafe", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(completedSteps / courseSteps.length) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #0f766e 0%, #2563eb 100%)",
                }}
              />
            </div>

            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
              Progress: {completedSteps}/{courseSteps.length} steps complete
            </div>

            <div style={{ ...panelStyle(), padding: 14, background: "#f8fafc", boxShadow: "none" }}>
              <div style={{ fontSize: 12, color: "#0f766e", fontWeight: 700 }}>{currentStep.title}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "4px 0 8px" }}>{currentStep.headline}</div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.55, marginBottom: 10 }}>{currentStep.concept}</div>

              <div style={{ ...badgeStyle("#e0f2fe", "#0c4a6e") }}>Goal: {currentStep.task}</div>
              <div style={{ ...badgeStyle("#ecfccb", "#3f6212") }}>Hint: {currentStep.hint}</div>

              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 14,
                  background: currentStepComplete ? "#dcfce7" : "#fff7ed",
                  color: currentStepComplete ? "#166534" : "#9a3412",
                  fontSize: 13,
                  border: `1px solid ${currentStepComplete ? "#86efac" : "#fed7aa"}`,
                }}
              >
                {currentStepComplete ? currentStep.success : "Current step is still in progress."}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
              <button style={smallButton(false)} onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}>
                Previous
              </button>
              <button style={smallButton(false)} onClick={resetCurrentStep}>
                Reset step
              </button>
              <button
                style={smallButton(currentStepComplete)}
                onClick={() => setStepIndex((value) => Math.min(courseSteps.length - 1, value + 1))}
                disabled={!currentStepComplete || stepIndex === courseSteps.length - 1}
              >
                Next
              </button>
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Concept Check</h3>
            {currentStep.quiz ? (
              <>
                <div style={{ fontSize: 14, color: "#0f172a", marginBottom: 10 }}>{currentStep.quiz.prompt}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {currentStep.quiz.options.map((option) => {
                    const selected = quizAnswer === option.id;
                    const correct = currentStep.quiz?.correct === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setQuizAnswers((prev) => ({ ...prev, [currentStep.id]: option.id }))}
                        style={{
                          padding: "11px 12px",
                          borderRadius: 12,
                          border: `1px solid ${selected ? (correct ? "#16a34a" : "#fb923c") : "#cbd5e1"}`,
                          background: selected ? (correct ? "#f0fdf4" : "#fff7ed") : "white",
                          textAlign: "left",
                          cursor: "pointer",
                          fontWeight: 600,
                          color: "#0f172a",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: quizPassed ? "#166534" : "#7c2d12" }}>
                  {quizFeedback ?? "Pick an answer before moving on."}
                </div>
              </>
            ) : (
              <div style={{ color: "#64748b", fontSize: 14 }}>
                This step is purely hands-on. Use the lattice interaction to build intuition.
              </div>
            )}
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Lab Controls</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {(["Z", "X", "Y"] as Tool[]).map((candidate) => {
                const allowed = currentStep.allowedTools.includes(candidate);
                return (
                  <button
                    key={candidate}
                    style={{
                      ...smallButton(tool === candidate),
                      opacity: allowed ? 1 : 0.45,
                      cursor: allowed ? "pointer" : "not-allowed",
                    }}
                    disabled={!allowed}
                    onClick={() => setTool(candidate)}
                  >
                    {candidate} operator
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <button style={smallButton(decoderType === "greedy")} onClick={() => setDecoderType("greedy")}>
                Greedy
              </button>
              <button style={smallButton(decoderType === "mwpm")} onClick={() => setDecoderType("mwpm")}>
                MWPM
              </button>
            </div>

            <div style={{ ...badgeStyle("#eff6ff", "#1d4ed8"), marginRight: 0 }}>
              Interaction mode: {currentStep.interactionMode === "focus" ? "guided focus" : currentStep.interactionMode === "decoder_only" ? "decoder only" : "free lab"}
            </div>
            <div style={{ ...badgeStyle(totalDefects === 0 ? "#dcfce7" : "#fef3c7", totalDefects === 0 ? "#166534" : "#92400e"), marginRight: 0 }}>
              Defects on board: {totalDefects}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <button style={smallButton(false)} onClick={applyFirstSuggestion} disabled={decoderSuggestions.length === 0 || !showDecoder}>
                Apply first decoder step
              </button>
              <button style={smallButton(false)} onClick={applyAllSuggestions} disabled={decoderSuggestions.length === 0 || !showDecoder}>
                Apply all decoder steps
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <button style={smallButton(false)} onClick={() => loadScenario("single_z")} disabled={currentStep.id !== "capstone"}>
                Load string
              </button>
              <button style={smallButton(false)} onClick={() => loadScenario("mixed")} disabled={currentStep.id !== "capstone"}>
                Load mixed case
              </button>
            </div>

            <div style={{ color: "#64748b", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
              Earlier steps intentionally limit controls so each new idea lands before the next one appears.
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Observed Syndromes</h3>
            <div>
              <span style={badgeStyle("#fef3c7", "#92400e")}>Vertex defects: {vertexCount}</span>
              <span style={badgeStyle("#dcfce7", "#166534")}>Plaquette defects: {plaquetteCount}</span>
              <span style={badgeStyle("#e0e7ff", "#3730a3")}>Manual moves: {stepMoves}</span>
              <span style={badgeStyle("#fce7f3", "#9d174d")}>Decoder actions: {decoderActions}</span>
            </div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
              Yellow dots mark vertex syndromes. Green tiles mark plaquette syndromes. Watch how strings move the endpoints while closed loops erase them.
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Activity Log</h3>
            {state.history.map((line, index) => (
              <div
                key={`${line}-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 9,
                  marginBottom: 8,
                  color: "#334155",
                  fontSize: 13,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0 }}>Interactive Lattice Lab</h2>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                Click highlighted edges when guided. In the capstone, the whole board opens up.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...badgeStyle(torus ? "#ede9fe" : "#e2e8f0", torus ? "#6d28d9" : "#334155"), marginRight: 0 }}>
                {torus ? "Torus mode on" : "Planar patch"}
              </div>
              <div style={{ ...badgeStyle(showDecoder ? "#dbeafe" : "#e2e8f0", showDecoder ? "#1d4ed8" : "#334155"), marginRight: 0 }}>
                {showDecoder ? `${decoderType.toUpperCase()} visible` : "Decoder hidden"}
              </div>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              width: 820,
              height: 820,
              maxWidth: "100%",
              aspectRatio: "1 / 1",
              border: "1px solid #dbe5f0",
              borderRadius: 24,
              background: "radial-gradient(circle at top, #ffffff 0%, #f8fafc 65%, #eef4fb 100%)",
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
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
                      border: active ? "2px solid #22c55e" : highlightedPlaquetteSet.has(key) ? "2px solid #10b981" : "1px solid #dbe5f0",
                      background: active ? "#dcfce7" : highlightedPlaquetteSet.has(key) ? "rgba(220, 252, 231, 0.9)" : "rgba(255,255,255,0.72)",
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: active ? "#166534" : highlightedPlaquetteSet.has(key) ? "#047857" : "#94a3b8",
                      boxShadow: highlightedPlaquetteSet.has(key) ? "0 0 0 4px rgba(16, 185, 129, 0.14)" : "none",
                    }}
                  >
                    {active ? "plaquette syndrome" : highlightedPlaquetteSet.has(key) ? "B_p" : ""}
                  </div>
                );
              }),
            )}

            {hEdges.map(({ key, r, c }) => {
              const op = state.edges[key] ?? "I";
              const suggestedTool = suggestionMap[key];
              const onLogicalZ = logicalZLoop.includes(key);
              const focused = focusEdgeSet.has(key);
              const locked = edgeLocked(key);
              return (
                <button
                  key={key}
                  onClick={() => applyMove(key)}
                  disabled={locked}
                  title={locked ? "This edge is locked for the current step." : key}
                  style={{
                    position: "absolute",
                    left: `${10 + c * 20}%`,
                    top: `${7 + r * 20}%`,
                    width: "18%",
                    height: 12,
                    borderRadius: 999,
                    border: "none",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: locked ? "default" : "pointer",
                    background: edgeColor(op),
                    outline:
                      showDecoder && suggestedTool
                        ? `3px dashed ${suggestedTool === "Z" ? "#dc2626" : "#2563eb"}`
                        : focused
                          ? "3px solid #f59e0b"
                          : highlightedSupportEdges.has(key)
                            ? "3px solid #14b8a6"
                            : currentStep.id === "stabilizer-intro"
                              ? "2px solid #cbd5e1"
                          : showLogicalZ && onLogicalZ
                            ? "3px solid #dc2626"
                            : "none",
                    boxShadow: focused
                      ? "0 0 0 3px rgba(245, 158, 11, 0.2)"
                      : highlightedSupportEdges.has(key)
                        ? "0 0 0 3px rgba(20, 184, 166, 0.16)"
                        : showLogicalZ && onLogicalZ
                          ? "0 0 0 3px rgba(220, 38, 38, 0.16)"
                          : "none",
                    opacity: locked && op === "I" ? 0.35 : 1,
                    outlineOffset: 2,
                  }}
                >
                  {op === "I" ? "" : op}
                </button>
              );
            })}

            {vEdges.map(({ key, r, c }) => {
              const op = state.edges[key] ?? "I";
              const suggestedTool = suggestionMap[key];
              const onLogicalX = logicalXLoop.includes(key);
              const focused = focusEdgeSet.has(key);
              const locked = edgeLocked(key);
              return (
                <button
                  key={key}
                  onClick={() => applyMove(key)}
                  disabled={locked}
                  title={locked ? "This edge is locked for the current step." : key}
                  style={{
                    position: "absolute",
                    left: `${7 + c * 20}%`,
                    top: `${10 + r * 20}%`,
                    width: 12,
                    height: "18%",
                    borderRadius: 999,
                    border: "none",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: locked ? "default" : "pointer",
                    background: edgeColor(op),
                    outline:
                      showDecoder && suggestedTool
                        ? `3px dashed ${suggestedTool === "Z" ? "#dc2626" : "#2563eb"}`
                        : focused
                          ? "3px solid #f59e0b"
                          : highlightedSupportEdges.has(key)
                            ? "3px solid #14b8a6"
                            : currentStep.id === "stabilizer-intro"
                              ? "2px solid #cbd5e1"
                          : showLogicalX && onLogicalX
                            ? "3px solid #2563eb"
                            : "none",
                    boxShadow: focused
                      ? "0 0 0 3px rgba(245, 158, 11, 0.2)"
                      : highlightedSupportEdges.has(key)
                        ? "0 0 0 3px rgba(20, 184, 166, 0.16)"
                        : showLogicalX && onLogicalX
                          ? "0 0 0 3px rgba(37, 99, 235, 0.16)"
                          : "none",
                    opacity: locked && op === "I" ? 0.35 : 1,
                    outlineOffset: 2,
                  }}
                >
                  <span style={{ display: "inline-block", transform: "rotate(-90deg)" }}>{op === "I" ? "" : op}</span>
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
                      width: 16,
                      height: 16,
                      transform: "translate(-50%, -50%)",
                      borderRadius: "50%",
                      border: active ? "2px solid #eab308" : highlightedVertexSet.has(key) ? "2px solid #f59e0b" : "2px solid #64748b",
                      background: active ? "#fde047" : highlightedVertexSet.has(key) ? "#fef3c7" : "white",
                      boxShadow: active ? "0 0 12px rgba(234, 179, 8, 0.35)" : highlightedVertexSet.has(key) ? "0 0 0 5px rgba(245, 158, 11, 0.14)" : "none",
                    }}
                  />
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

          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16, marginTop: 16 }}>
            <div style={{ ...panelStyle(), padding: 14, boxShadow: "none", background: "#f8fafc" }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Why This Step Matters</h3>
              <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.6 }}>{currentStep.concept}</div>
            </div>

            <div style={{ ...panelStyle(), padding: 14, boxShadow: "none", background: "#f8fafc" }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>{currentStep.formula ? "Stabilizer Lens" : "Decoder Preview"}</h3>
              {currentStep.formula ? (
                <>
                  <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 700, lineHeight: 1.6, marginBottom: 8 }}>
                    {currentStep.formula}
                  </div>
                  <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                    {currentStep.visualTakeaway}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ border: "1px solid #fde68a", borderRadius: 10, padding: 8, background: "#fffbeb", fontSize: 13, color: "#92400e" }}>
                      Yellow vertices: X-type star stabilizers, measured as local parity checks.
                    </div>
                    <div style={{ border: "1px solid #a7f3d0", borderRadius: 10, padding: 8, background: "#ecfdf5", fontSize: 13, color: "#065f46" }}>
                      Green plaquettes: Z-type stabilizers, also measured locally.
                    </div>
                    <div style={{ border: "1px solid #99f6e4", borderRadius: 10, padding: 8, background: "#f0fdfa", fontSize: 13, color: "#155e75" }}>
                      Teal edges: the qubits multiplied together by the highlighted stabilizer generator.
                    </div>
                  </div>
                </>
              ) : showDecoder ? (
                decoderSuggestions.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>No active syndrome pairs to connect right now.</div>
                ) : (
                  decoderSuggestions.slice(0, 8).map((step, index) => (
                    <div
                      key={`${step.target}-${index}`}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 8,
                        marginBottom: 6,
                        fontSize: 13,
                        background: "white",
                      }}
                    >
                      Step {index + 1}: apply <strong>{step.tool}</strong> on <code>{step.target}</code> to reduce {step.defectType} defects.
                    </div>
                  ))
                )
              ) : (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Decoder suggestions appear later, after the syndrome picture makes sense by itself.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
