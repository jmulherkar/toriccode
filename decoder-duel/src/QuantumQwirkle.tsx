import React, { useMemo, useState } from "react";

const BOARD_SIZE = 7;
const RACK_SIZE = 4;
const COPIES_PER_TYPE = 8;

type PlayerId = 1 | 2;
type ZState = "0" | "1";
type XState = "+" | "-";

type QuantumTile = {
  id: string;
  z: ZState;
  x: XState;
};

type BoardTile = QuantumTile & {
  owner: PlayerId;
};

type BoardState = Record<string, BoardTile | undefined>;
type RackState = Record<PlayerId, QuantumTile[]>;
type ScoreState = Record<PlayerId, number>;

type PlacementResult =
  | {
      ok: true;
      score: number;
      touchedNeighbors: number;
      relationSummary: string;
    }
  | {
      ok: false;
      reason: string;
    };

type GameState = {
  board: BoardState;
  bag: QuantumTile[];
  racks: RackState;
  scores: ScoreState;
  currentPlayer: PlayerId;
  selectedTileId: string | null;
  selectedCellKey: string | null;
  turnMessage: string;
  lastMoveSummary: string;
  gameOver: boolean;
};

function cellKey(row: number, col: number) {
  return `${row}-${col}`;
}

function parseCellKey(key: string) {
  const [row, col] = key.split("-").map(Number);
  return { row, col };
}

function panelStyle(): React.CSSProperties {
  return {
    background: "rgba(255, 255, 255, 0.94)",
    border: "1px solid #d9e2ec",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(10px)",
  };
}

function actionButton(active = false): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "#0f172a" : "#cbd5e1"}`,
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    cursor: "pointer",
    fontWeight: 700,
  };
}

function badgeStyle(background: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 11px",
    borderRadius: 999,
    background,
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 700,
    marginRight: 8,
    marginBottom: 8,
  };
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function buildBag() {
  const baseTypes: Array<{ z: ZState; x: XState }> = [
    { z: "0", x: "+" },
    { z: "0", x: "-" },
    { z: "1", x: "+" },
    { z: "1", x: "-" },
  ];
  const bag: QuantumTile[] = [];
  let id = 0;

  for (const type of baseTypes) {
    for (let copy = 0; copy < COPIES_PER_TYPE; copy += 1) {
      bag.push({
        id: `tile-${id}`,
        z: type.z,
        x: type.x,
      });
      id += 1;
    }
  }

  return shuffle(bag);
}

function drawTiles(bag: QuantumTile[], count: number) {
  return {
    drawn: bag.slice(0, count),
    remaining: bag.slice(count),
  };
}

function createInitialState(): GameState {
  const bag = buildBag();
  const playerOneDraw = drawTiles(bag, RACK_SIZE);
  const playerTwoDraw = drawTiles(playerOneDraw.remaining, RACK_SIZE);

  return {
    board: {},
    bag: playerTwoDraw.remaining,
    racks: {
      1: playerOneDraw.drawn,
      2: playerTwoDraw.drawn,
    },
    scores: { 1: 0, 2: 0 },
    currentPlayer: 1,
    selectedTileId: null,
    selectedCellKey: null,
    turnMessage:
      "Player 1 starts. Pick a qubit tile and place it on the center cell to seed the lattice.",
    lastMoveSummary:
      "Legal neighbors must agree in exactly one basis: Z1Z2 = -1 and X1X2 = +1, or Z1Z2 = +1 and X1X2 = -1.",
    gameOver: false,
  };
}

function getBoardTile(board: BoardState, row: number, col: number) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return undefined;
  }
  return board[cellKey(row, col)];
}

function listNeighbors(board: BoardState, row: number, col: number) {
  return [
    getBoardTile(board, row - 1, col),
    getBoardTile(board, row + 1, col),
    getBoardTile(board, row, col - 1),
    getBoardTile(board, row, col + 1),
  ].filter(Boolean) as BoardTile[];
}

function isBoardEmpty(board: BoardState) {
  return Object.values(board).every((tile) => !tile);
}

function isCenterCell(row: number, col: number) {
  const center = Math.floor(BOARD_SIZE / 2);
  return row === center && col === center;
}

function relationLabel(first: QuantumTile, second: QuantumTile) {
  const sameZ = first.z === second.z;
  const sameX = first.x === second.x;

  if (sameZ && !sameX) {
    return "same color, different shape";
  }

  if (!sameZ && sameX) {
    return "different color, same shape";
  }

  return "forbidden relation";
}

function validatePlacement(
  board: BoardState,
  row: number,
  col: number,
  tile: QuantumTile,
): PlacementResult {
  const key = cellKey(row, col);
  if (board[key]) {
    return {
      ok: false,
      reason: "That cell is already occupied by another qubit tile.",
    };
  }

  const neighbors = listNeighbors(board, row, col);

  if (isBoardEmpty(board)) {
    if (!isCenterCell(row, col)) {
      return {
        ok: false,
        reason: "The opening move has to be played in the center of the board.",
      };
    }

    return {
      ok: true,
      score: 1,
      touchedNeighbors: 0,
      relationSummary: "Opening qubit placed at the center for 1 point.",
    };
  }

  if (neighbors.length === 0) {
    return {
      ok: false,
      reason: "A new qubit must touch the existing lattice orthogonally.",
    };
  }

  const relationNotes: string[] = [];
  for (const neighbor of neighbors) {
    const sameZ = tile.z === neighbor.z;
    const sameX = tile.x === neighbor.x;

    if (sameZ === sameX) {
      return {
        ok: false,
        reason:
          "Every neighboring pair must match in exactly one attribute. Same-same and different-different are both illegal.",
      };
    }

    relationNotes.push(relationLabel(tile, neighbor));
  }

  return {
    ok: true,
    score: neighbors.length,
    touchedNeighbors: neighbors.length,
    relationSummary: relationNotes.join(" + "),
  };
}

function tileFaceStyle(tile: { z: ZState; x: XState }, selected: boolean, disabled: boolean) {
  const zBackground = tile.z === "0" ? "#fee2e2" : "#dbeafe";
  const xBackground = tile.x === "+" ? "#dcfce7" : "#fef3c7";

  return {
    borderRadius: 18,
    border: `2px solid ${selected ? "#0f172a" : "#cbd5e1"}`,
    background: disabled ? "#f1f5f9" : "white",
    color: "#0f172a",
    padding: 12,
    minHeight: 108,
    textAlign: "left" as const,
    cursor: disabled ? "default" : "pointer",
    boxShadow: selected ? "0 0 0 4px rgba(14, 165, 233, 0.18)" : "none",
    opacity: disabled ? 0.68 : 1,
    display: "grid",
    gap: 10,
    gridTemplateRows: "auto 1fr",
    overflow: "hidden" as const,
    position: "relative" as const,
    backgroundImage: `linear-gradient(135deg, ${zBackground}, ${xBackground})`,
  };
}

export default function QuantumQwirkle() {
  const [game, setGame] = useState<GameState>(() => createInitialState());

  const cells = useMemo(
    () =>
      Array.from({ length: BOARD_SIZE }, (_, row) =>
        Array.from({ length: BOARD_SIZE }, (_, col) => ({
          key: cellKey(row, col),
          row,
          col,
        })),
      ).flat(),
    [],
  );

  const currentRack = game.racks[game.currentPlayer];

  const selectedTile = currentRack.find((tile) => tile.id === game.selectedTileId) ?? null;

  const selectTile = (tileId: string) => {
    if (game.gameOver) {
      return;
    }

    setGame((prev) => ({
      ...prev,
      selectedTileId: prev.selectedTileId === tileId ? null : tileId,
      turnMessage:
        prev.selectedTileId === tileId
          ? `Player ${prev.currentPlayer}, pick a tile or inspect the board.`
          : `Player ${prev.currentPlayer}, choose where to place your selected qubit.`,
    }));
  };

  const inspectCell = (key: string) => {
    if (game.gameOver) {
      return;
    }

    const { row, col } = parseCellKey(key);
    const occupant = game.board[key];

    if (occupant) {
      setGame((prev) => ({
        ...prev,
        selectedCellKey: key,
        turnMessage: `Cell (${row + 1}, ${col + 1}) holds a P${occupant.owner} qubit with color ${occupant.z} and shape ${occupant.x}.`,
      }));
      return;
    }

    if (!selectedTile) {
      setGame((prev) => ({
        ...prev,
        selectedCellKey: key,
        turnMessage: `Empty cell (${row + 1}, ${col + 1}). Select a tile first to try a placement.`,
      }));
      return;
    }

    const preview = validatePlacement(game.board, row, col, selectedTile);
    setGame((prev) => ({
      ...prev,
      selectedCellKey: key,
      turnMessage: preview.ok
        ? `Legal move at (${row + 1}, ${col + 1}). It would score ${preview.score} from ${preview.touchedNeighbors || 1} relation${preview.touchedNeighbors === 1 ? "" : "s"}.`
        : preview.reason,
    }));
  };

  const placeSelectedTile = (row: number, col: number) => {
    if (game.gameOver) {
      return;
    }

    const activeTile = currentRack.find((tile) => tile.id === game.selectedTileId);
    if (!activeTile) {
      setGame((prev) => ({
        ...prev,
        turnMessage: `Player ${prev.currentPlayer}, select a tile from your rack first.`,
      }));
      return;
    }

    const validation = validatePlacement(game.board, row, col, activeTile);
    if (!validation.ok) {
      setGame((prev) => ({
        ...prev,
        selectedCellKey: cellKey(row, col),
        turnMessage: validation.reason,
      }));
      return;
    }

    setGame((prev) => {
      const boardKey = cellKey(row, col);
      const activePlayer = prev.currentPlayer;
      const nextPlayer: PlayerId = activePlayer === 1 ? 2 : 1;
      const nextBoard: BoardState = {
        ...prev.board,
        [boardKey]: {
          ...activeTile,
          owner: activePlayer,
        },
      };
      const nextRack = prev.racks[activePlayer].filter((tile) => tile.id !== activeTile.id);
      const refill = drawTiles(prev.bag, Math.max(0, RACK_SIZE - nextRack.length));
      const replenishedRack = [...nextRack, ...refill.drawn];
      const nextRacks: RackState = {
        ...prev.racks,
        [activePlayer]: replenishedRack,
      };
      const nextScores: ScoreState = {
        ...prev.scores,
        [activePlayer]: prev.scores[activePlayer] + validation.score,
      };
      const totalRemainingTiles =
        refill.remaining.length + nextRacks[1].length + nextRacks[2].length;
      const gameOver = totalRemainingTiles === 0;

      return {
        board: nextBoard,
        bag: refill.remaining,
        racks: nextRacks,
        scores: nextScores,
        currentPlayer: gameOver ? activePlayer : nextPlayer,
        selectedTileId: null,
        selectedCellKey: boardKey,
        turnMessage: gameOver
          ? `Game over. Player ${activePlayer} made the last quantum placement.`
          : `Player ${nextPlayer}, your turn. Match one basis and mismatch the other.`,
        lastMoveSummary: `P${activePlayer} placed ${activeTile.z}/${activeTile.x} at (${row + 1}, ${col + 1}) for ${validation.score} point${validation.score === 1 ? "" : "s"}: ${validation.relationSummary}.`,
        gameOver,
      };
    });
  };

  const resetGame = () => {
    setGame(createInitialState());
  };

  const relationLegend = [
    {
      title: "Allowed pair A",
      description: "same color, different shape",
      operator: "Z1Z2 = +1, X1X2 = -1",
      tone: "#fee2e2",
    },
    {
      title: "Allowed pair B",
      description: "different color, same shape",
      operator: "Z1Z2 = -1, X1X2 = +1",
      tone: "#dbeafe",
    },
    {
      title: "Forbidden pair",
      description: "same-same or different-different",
      operator: "matches zero or two attributes",
      tone: "#f1f5f9",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #dbeafe 0%, transparent 35%), radial-gradient(circle at top right, #fee2e2 0%, transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "360px minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={panelStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Quantum Qwirkle</h2>
            <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
              Each tile is a qubit with a visible <strong>Z color</strong> (`0` or `1`)
              and an <strong>X shape</strong> (`+` or `-`). A neighboring pair is legal
              only when it agrees in exactly one basis.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button style={actionButton()} onClick={resetGame}>
                New game
              </button>
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Constraint rules</h3>
            {relationLegend.map((item) => (
              <div
                key={item.title}
                style={{
                  borderRadius: 16,
                  background: item.tone,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                  {item.title}
                </div>
                <div style={{ color: "#334155", fontSize: 14, marginBottom: 4 }}>
                  {item.description}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{item.operator}</div>
              </div>
            ))}
            <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              Score <strong>1 point per valid new neighbor relation</strong>. The first
              center tile scores 1 point to get the lattice started.
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Status</h3>
            <div>
              <span style={badgeStyle("#dbeafe")}>Current player: P{game.currentPlayer}</span>
              <span style={badgeStyle("#dcfce7")}>Bag: {game.bag.length}</span>
              <span style={badgeStyle("#fef3c7")}>P1: {game.scores[1]}</span>
              <span style={badgeStyle("#fee2e2")}>P2: {game.scores[2]}</span>
              {game.gameOver && <span style={badgeStyle("#e2e8f0")}>Finished</span>}
            </div>
            <div style={{ color: "#334155", fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
              {game.turnMessage}
            </div>
            <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              {game.lastMoveSummary}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Player racks</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {[1, 2].map((player) => {
                const playerId = player as PlayerId;
                const isActive = playerId === game.currentPlayer;

                return (
                  <div
                    key={playerId}
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${isActive ? "#93c5fd" : "#e2e8f0"}`,
                      background: isActive ? "#f8fbff" : "#f8fafc",
                      padding: 14,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>
                      Player {playerId} rack {isActive ? "(active)" : ""}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {game.racks[playerId].map((tile) => (
                        <button
                          key={tile.id}
                          onClick={() => isActive && selectTile(tile.id)}
                          style={tileFaceStyle(
                            tile,
                            game.selectedTileId === tile.id,
                            !isActive || game.gameOver,
                          )}
                        >
                          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                            qubit
                          </div>
                          <div>
                            <div style={{ fontSize: 14, color: "#334155", marginBottom: 3 }}>
                              color Z = {tile.z}
                            </div>
                            <div style={{ fontSize: 14, color: "#334155" }}>
                              shape X = {tile.x}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Lattice board</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                gap: 10,
              }}
            >
              {cells.map(({ key, row, col }) => {
                const tile = game.board[key];
                const isCenter = isCenterCell(row, col);
                const isSelectedCell = game.selectedCellKey === key;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      inspectCell(key);
                      if (!tile) {
                        placeSelectedTile(row, col);
                      }
                    }}
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 18,
                      border: isSelectedCell
                        ? "2px solid #0ea5e9"
                        : tile
                          ? "2px solid #1e293b"
                          : isCenter
                            ? "2px dashed #64748b"
                            : "1px dashed #cbd5e1",
                      background: tile
                        ? tile.z === "0"
                          ? "linear-gradient(135deg, #fee2e2, #dcfce7)"
                          : "linear-gradient(135deg, #dbeafe, #fef3c7)"
                        : isCenter
                          ? "#f8fafc"
                          : "rgba(255,255,255,0.92)",
                      color: "#0f172a",
                      padding: 8,
                      cursor: game.gameOver ? "default" : "pointer",
                      display: "grid",
                      alignItems: "center",
                      justifyItems: "center",
                    }}
                    title={`row ${row + 1}, col ${col + 1}`}
                  >
                    {tile ? (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>
                          P{tile.owner}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                          {tile.z}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
                          {tile.x}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8" }}>
                        <div style={{ fontSize: 11, marginBottom: 2 }}>
                          {isCenter ? "start" : "empty"}
                        </div>
                        <div style={{ fontSize: 12 }}>
                          {row + 1},{col + 1}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
