const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Adjustable depth for hard mode
const HARD_DEPTH = 6; // tune: 4-6 usually OK; larger = stronger but slower

function cloneGame(pits, stores) {
  return {
    pits: pits.map(row => [...row]),
    stores: [...stores]
  };
}

// Simulate a move including captures and extra-turns
function simulateMove(pits, stores, player, pitIndex) {
  const { pits: newPits, stores: newStores } = cloneGame(pits, stores);

  let stones = newPits[player][pitIndex];
  newPits[player][pitIndex] = 0;

  let p = player;
  let i = pitIndex;

  // track last landing
  let lastP = null;
  let lastI = null;

  while (stones > 0) {
    i++;
    if (i === 7) {
      // store
      if (p === player) {
        newStores[player]++;
        stones--;
        lastP = 'store';
        if (stones === 0) {
          // extra turn
          return { pits: newPits, stores: newStores, nextPlayer: player };
        }
      }
      p = 1 - p;
      i = -1;
    } else {
      newPits[p][i]++;
      stones--;
      if (stones === 0) {
        lastP = p;
        lastI = i;
      }
    }
  }

  // Apply capture rule (if last landed on player's side and was empty before -> now 1)
  if (lastP === player && typeof lastI === "number" && newPits[lastP][lastI] === 1) {
    const opposite = 6 - lastI;
    const captured = newPits[1 - lastP][opposite];
    if (captured > 0) {
      newStores[player] += captured + 1;
      newPits[lastP][lastI] = 0;
      newPits[1 - lastP][opposite] = 0;
    }
  }

  return { pits: newPits, stores: newStores, nextPlayer: 1 - player };
}

// Terminal/gameover check: returns evaluation (botStore - opponentStore)
function evaluateTerminal(pits, stores, botPlayer) {
  // if one side empty -> collect remaining
  const empty0 = pits[0].every(v => v === 0);
  const empty1 = pits[1].every(v => v === 0);
  const s = [...stores];
  if (empty0 || empty1) {
    if (!empty0) s[0] += pits[0].reduce((a,b) => a+b, 0);
    if (!empty1) s[1] += pits[1].reduce((a,b) => a+b, 0);
    return s[botPlayer] - s[1 - botPlayer];
  }
  return null; // not terminal
}

function evaluateBoard(pits, stores, botPlayer) {
  return stores[botPlayer] - stores[1 - botPlayer];
}

// Minimax with alpha-beta
function minimax(pits, stores, depth, player, botPlayer, alpha, beta) {
  // Terminal check
  const termVal = evaluateTerminal(pits, stores, botPlayer);
  if (termVal !== null) return termVal;

  if (depth === 0) {
    return evaluateBoard(pits, stores, botPlayer);
  }

  const moves = pits[player]
    .map((stones, idx) => (stones > 0 ? idx : null))
    .filter(idx => idx !== null);

  if (moves.length === 0) {
    // no moves: evaluate current board
    return evaluateBoard(pits, stores, botPlayer);
  }

  if (player === botPlayer) {
    // maximizing
    let value = -Infinity;
    for (let mv of moves) {
      const { pits: np, stores: ns, nextPlayer } = simulateMove(pits, stores, player, mv);
      const evalScore = minimax(np, ns, depth - 1, nextPlayer, botPlayer, alpha, beta);
      value = Math.max(value, evalScore);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break; // prune
    }
    return value;
  } else {
    // minimizing
    let value = Infinity;
    for (let mv of moves) {
      const { pits: np, stores: ns, nextPlayer } = simulateMove(pits, stores, player, mv);
      const evalScore = minimax(np, ns, depth - 1, nextPlayer, botPlayer, alpha, beta);
      value = Math.min(value, evalScore);
      beta = Math.min(beta, value);
      if (alpha >= beta) break; // prune
    }
    return value;
  }
}

app.post("/sungka-bot", (req, res) => {
  const { pits, stores, player, level } = req.body;
  if (!Array.isArray(pits) || !Array.isArray(stores) || typeof player !== "number") {
    return res.status(400).json({ error: "Invalid request" });
  }

  const validMoves = pits[player].map((s,i) => s>0?i:null).filter(i => i !== null);
  if (validMoves.length === 0) return res.json({ move: -1 });

  // EASY: random
  if (level === "easy") {
    const choice = validMoves[Math.floor(Math.random() * validMoves.length)];
    return res.json({ move: choice });
  }

  // MEDIUM: prefer extra-turn moves (simulate to check)
  if (level === "medium") {
    const extra = validMoves.filter(idx => {
      const sim = simulateMove(pits, stores, player, idx);
      return sim.nextPlayer === player; // landed in store (extra turn)
    });
    if (extra.length > 0) {
      return res.json({ move: extra[Math.floor(Math.random() * extra.length)] });
    } else {
      return res.json({ move: validMoves[Math.floor(Math.random() * validMoves.length)] });
    }
  }

  // HARD: minimax + alpha-beta
  let bestScore = -Infinity;
  let bestMove = validMoves[0];

  for (let mv of validMoves) {
    const { pits: np, stores: ns, nextPlayer } = simulateMove(pits, stores, player, mv);
    const score = minimax(np, ns, HARD_DEPTH - 1, nextPlayer, player, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = mv;
    }
  }

  return res.json({ move: bestMove });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sungka Bot API listening on http://localhost:${PORT}`);
});