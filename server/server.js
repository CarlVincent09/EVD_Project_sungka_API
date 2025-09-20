const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Adjustable depth for hard mode
const HARD_DEPTH = 6; // tune: 4-6 usually OK; larger = stronger but slower

// Helper function to create deep copies of game state
function cloneGame(pits, stores) {
  return {
    pits: pits.map(row => [...row]),
    stores: [...stores]
  };
}

// Simulate a move including captures and extra-turns
// This function needs to be robust and correctly handle all game rules
function simulateMove(pits, stores, player, pitIndex) {
  const { pits: newPits, stores: newStores } = cloneGame(pits, stores);

  let stones = newPits[player][pitIndex];
  newPits[player][pitIndex] = 0;

  let p = player; // Current player for sowing
  let i = pitIndex; // Current pit index for sowing

  // track last landing
  let lastP = null;
  let lastI = null;
  let extraTurn = false;
  let captureOccurred = false;

  while (stones > 0) {
    i++;
    if (i === 7) {
      // Landed in a store
      if (p === player) { // If it's the current player's own store
        newStores[player]++;
        stones--;
        if (stones === 0) {
          extraTurn = true; // Landed exactly in own store, extra turn
          break; // End sowing
        }
      }
      p = 1 - p; // Switch to the other player's row
      i = -1; // Reset index to start from 0 on the next row
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
  // Ensure this happens *only* if the last pit was indeed empty before the stone landed
  if (!extraTurn && lastP === player && typeof lastI === "number" && newPits[lastP][lastI] === 1) {
    const opposite = 6 - lastI;
    const capturedStonesInOpposite = newPits[1 - lastP][opposite];
    if (capturedStonesInOpposite > 0) {
      newStores[player] += capturedStonesInOpposite + 1; // +1 for the stone that landed
      newPits[lastP][lastI] = 0;
      newPits[1 - lastP][opposite] = 0;
      captureOccurred = true;
    }
  }

  const nextPlayer = extraTurn ? player : (1 - player);

  return { 
    pits: newPits, 
    stores: newStores, 
    nextPlayer: nextPlayer,
    extraTurn: extraTurn,        
    captureOccurred: captureOccurred 
  };
}

// Terminal/gameover check: returns evaluation (botStore - opponentStore)
// This function assumes the game is over and sums up all remaining stones.
function evaluateTerminal(pits, stores, botPlayer) {
  const empty0 = pits[0].every(v => v === 0);
  const empty1 = pits[1].every(v => v === 0);

  if (empty0 || empty1) {
    const finalStores = [...stores]; // Create a copy for final calculation
    if (!empty0) finalStores[0] += pits[0].reduce((a,b) => a+b, 0);
    if (!empty1) finalStores[1] += pits[1].reduce((a,b) => a+b, 0);
    return finalStores[botPlayer] - finalStores[1 - botPlayer];
  }
  return null; // not terminal
}

// Evaluates a non-terminal board state
function evaluateBoard(pits, stores, botPlayer) {
  // A simple evaluation is just the difference in store counts
  let score = stores[botPlayer] - stores[1 - botPlayer];

  // Add a small bonus for having more stones on your side of the board
  // This encourages keeping the game alive and controlling more pits
  const botSideStones = pits[botPlayer].reduce((a,b) => a+b, 0);
  const opponentSideStones = pits[1 - botPlayer].reduce((a,b) => a+b, 0);
  score += (botSideStones - opponentSideStones) * 0.1; // Small weight

  return score;
}


// Minimax with alpha-beta pruning
function minimax(pits, stores, depth, player, botPlayer, alpha, beta) {
  // Terminal check
  const termVal = evaluateTerminal(pits, stores, botPlayer);
  if (termVal !== null) {
      return termVal;
  }

  // Depth limit reached
  if (depth === 0) {
      return evaluateBoard(pits, stores, botPlayer);
  }

  const moves = pits[player]
    .map((stones, idx) => (stones > 0 ? idx : null))
    .filter(idx => idx !== null);

  // If no valid moves for the current player at this depth, evaluate current board
  if (moves.length === 0) {
    return evaluateBoard(pits, stores, botPlayer);
  }

  if (player === botPlayer) {
    // Maximizing player (Bot)
    let value = -Infinity;
    for (let mv of moves) {
      const { pits: np, stores: ns, nextPlayer } = simulateMove(pits, stores, player, mv);
      const evalScore = minimax(np, ns, depth - 1, nextPlayer, botPlayer, alpha, beta);
      value = Math.max(value, evalScore);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break; // Alpha-beta prune
    }
    return value;
  } else {
    // Minimizing player (Opponent)
    let value = Infinity;
    for (let mv of moves) {
      const { pits: np, stores: ns, nextPlayer } = simulateMove(pits, stores, player, mv);
      const evalScore = minimax(np, ns, depth - 1, nextPlayer, botPlayer, alpha, beta);
      value = Math.min(value, evalScore);
      beta = Math.min(beta, value);
      if (alpha >= beta) break; // Alpha-beta prune
    }
    return value;
  }
}

// API endpoint for the Sungka Bot
app.post("/sungka-bot", (req, res) => {
  const { pits, stores, player, level } = req.body;
  
  // Basic input validation
  if (!Array.isArray(pits) || !Array.isArray(stores) || typeof player !== "number") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const validMoves = pits[player].map((s,i) => s>0?i:null).filter(i => i !== null);
  if (validMoves.length === 0) {
      // If the current player (bot) has no moves, indicate this.
      // The client-side will need to handle passing the turn.
      return res.json({ move: -1 });
  }

  let chosenMove;

  switch (level) {
    case "easy":
      // Easy: random valid move
      chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      break;

    case "medium":
      // Medium: Prioritize extra-turn, then captures, else random
      let extraTurnMoves = [];
      let captureMoves = [];

      for (const mv of validMoves) {
          const sim = simulateMove(pits, stores, player, mv);
          if (sim.extraTurn) {
              extraTurnMoves.push(mv);
          } else if (sim.captureOccurred) {
              captureMoves.push(mv);
          }
      }

      if (extraTurnMoves.length > 0) {
        chosenMove = extraTurnMoves[Math.floor(Math.random() * extraTurnMoves.length)];
      } else if (captureMoves.length > 0) {
        chosenMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
      } else {
        chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      }
      break;

    case "hard":
      // HARD: minimax with alpha-beta pruning
      let bestScore = -Infinity;
      let hardBestMove = validMoves[0]; // Default to the first valid move

      for (let mv of validMoves) {
        const { pits: np, stores: ns, nextPlayer } = simulateMove(pits, stores, player, mv);
        // The minimax function is called from the perspective of 'player' (the bot)
        const score = minimax(np, ns, HARD_DEPTH - 1, nextPlayer, player, -Infinity, Infinity);

        if (score > bestScore) {
          bestScore = score;
          hardBestMove = mv;
        }
        // Tie-breaking: if scores are equal, prefer moves closer to the bot's store (higher index)
        else if (score === bestScore && mv > hardBestMove) {
            hardBestMove = mv;
        }
      }
      chosenMove = hardBestMove;
      break;

    default:
      // Fallback for unknown levels
      chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      break;
  }

  return res.json({ move: chosenMove });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sungka Bot API listening on http://localhost:${PORT}`);
});