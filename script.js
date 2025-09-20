const INITIAL_STONES = 7;
let pits = [Array(7).fill(INITIAL_STONES), Array(7).fill(INITIAL_STONES)];
let stores = [0, 0];
let currentPlayer = 0; // 0 for Player 1 (bottom), 1 for Player 2 (top/bot)
let isBotThinking = false;
let currentLevel = "medium";

// --- DOM Elements ---
const topRow = document.getElementById("top-row");
const bottomRow = document.getElementById("bottom-row");
const store0El = document.getElementById("store0");
const store1El = document.getElementById("store1");
const currentEl = document.getElementById("current");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("reset");
const botToggle = document.getElementById("botToggle");
const difficultySelect = document.getElementById("difficulty");

// --- Hand Element for Animation ---
const handEl = document.createElement("div");
handEl.id = "hand";
document.body.appendChild(handEl);

// CSS for hand (basic) - This can stay in script.js or be moved to styles.css
const style = document.createElement("style");
style.textContent = `
  #hand {
    position: absolute;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: url('hand.png') no-repeat center/contain;
    pointer-events: none;
    display: none;
    z-index: 999;
    transition: top 0.3s, left 0.3s;
  }
`;
document.head.appendChild(style);

// --- Event Listeners ---
difficultySelect.addEventListener("change", () => {
  currentLevel = difficultySelect.value;
});

resetBtn.addEventListener("click", () => {
  pits = [Array(7).fill(INITIAL_STONES), Array(7).fill(INITIAL_STONES)];
  stores = [0, 0];
  currentPlayer = 0;
  isBotThinking = false;
  messageEl.textContent = "";
  renderBoard();
});

botToggle.addEventListener("change", () => {
  // If bot is enabled and it's currently bot's turn, make it move
  if (botToggle.checked && currentPlayer === 1) {
    setTimeout(botMove, 400); // Small delay before bot moves
  }
  renderBoard(); // Re-render to update pit clickability
});

// --- Game Logic Functions ---

// Renders the current state of the board in the UI
function renderBoard() {
  topRow.innerHTML = "";
  bottomRow.innerHTML = "";

  // Player 2 (Bot/Top) pits
  for (let i = 6; i >= 0; i--) { // Render top row from right to left to match visual layout
    topRow.appendChild(createPit(1, i));
  }

  // Player 1 (Human/Bottom) pits
  for (let i = 0; i < 7; i++) {
    bottomRow.appendChild(createPit(0, i));
  }

  store0El.textContent = stores[0]; // Player 1's store
  store1El.textContent = stores[1]; // Player 2's store
  currentEl.textContent = currentPlayer === 0 ? "Player 1" : "Player 2";
}

// Creates a single pit element with its stones
function createPit(player, idx) {
  const pitEl = document.createElement("div");
  pitEl.className = "pit";
  pitEl.dataset.player = player;
  pitEl.dataset.idx = idx; // Store index for easier identification

  const stonesContainer = document.createElement("div");
  stonesContainer.className = "stones";

  // Create individual stone elements
  for (let s = 0; s < pits[player][idx]; s++) {
    const stone = document.createElement("div");
    stone.className = "stone";
    stonesContainer.appendChild(stone);
  }

  const countEl = document.createElement("div");
  countEl.className = "pit-count";
  countEl.textContent = pits[player][idx];

  pitEl.appendChild(stonesContainer);
  pitEl.appendChild(countEl);

  const isHumanTurn = !(currentPlayer === 1 && botToggle.checked); // True if it's Player 1's turn or Player 2's turn but bot is off
  const isClickable = player === currentPlayer && pits[player][idx] > 0 && isHumanTurn && !isBotThinking;

  if (isClickable) {
    pitEl.addEventListener("click", () => animateMove(player, idx));
  } else {
    pitEl.classList.add("disabled");
  }

  return pitEl;
}

// Animates the sowing of stones
function animateMove(player, idx) {
  // Prevent moves if it's not the current player's turn, bot is thinking, or pit is empty
  if (player !== currentPlayer || isBotThinking || pits[player][idx] === 0) return;

  messageEl.textContent = ""; // Clear any previous messages

  let stonesInHand = pits[player][idx];
  pits[player][idx] = 0; // Empty the clicked pit
  renderBoard(); // Update UI to show empty pit

  let p = player; // Current player for sowing (changes during sowing)
  let i = idx; // Current pit index for sowing (changes during sowing)
  let lastP = null; // Player of the pit where the last stone landed
  let lastI = null; // Index of the pit where the last stone landed

  const dropStone = () => {
    if (stonesInHand === 0) {
      // --- Sowing is complete ---

      // Check for capture: last stone landed in own empty pit
      if (lastP === player && typeof lastI === "number" && pits[lastP][lastI] === 1) {
        const opposite = 6 - lastI; // Calculate opposite pit index
        const capturedStones = pits[1 - lastP][opposite]; // Stones in opponent's opposite pit
        if (capturedStones > 0) {
          stores[player] += capturedStones + 1; // Add captured stones + the landing stone
          pits[lastP][lastI] = 0; // Empty the pit where the last stone landed
          pits[1 - lastP][opposite] = 0; // Empty the opponent's opposite pit
          messageEl.textContent = `Capture! Player ${player + 1} captured ${capturedStones} stones.`;
        }
      }

      // Determine next player
      // If the last stone landed in the current player's store, it's an extra turn (currentPlayer remains the same)
      // Otherwise, turn switches to the other player (currentPlayer = 1 - currentPlayer)
      // This is handled by animateMove's logic where it only updates currentPlayer if no extra turn was given
      // The core game logic ensures currentPlayer is already handled if a store drop caused an extra turn.

      currentPlayer = 1 - currentPlayer; // Switch turn by default (unless an extra turn was awarded)
      renderBoard();
      const gameOver = checkGameOver();

      // If game isn't over and it's now bot's turn, make bot move
      if (!gameOver && currentPlayer === 1 && botToggle.checked) {
        setTimeout(botMove, 800);
      }

      handEl.style.display = "none"; // Hide the hand
      return; // End the animation
    }

    // --- Continue Sowing ---
    i++; // Move to the next pit/store

    if (i === 7) {
      // Reached the end of a row (potential store or switch rows)
      if (p === player) {
        // Current player's own store
        stores[player]++;
        stonesInHand--;
        renderBoard(); // Update score display

        lastP = "store"; // Indicate last stone potentially landed in store

        // Move hand animation to the store
        const storeEl = player === 0 ? store0El : store1El;
        const rect = storeEl.getBoundingClientRect();
        handEl.style.left = rect.left + "px";
        handEl.style.top = rect.top - 50 + "px";
        handEl.style.display = "block";
        handEl.classList.add("drop");
        setTimeout(() => handEl.classList.remove("drop"), 200);

        if (stonesInHand === 0) {
          // Last stone landed in own store -> extra turn!
          messageEl.textContent = "Extra turn!";
          renderBoard();
          const gameOver = checkGameOver();
          setTimeout(() => {
            // If the player who got an extra turn is the bot and game is not over, make it move again
            if (!gameOver && currentPlayer === player && botToggle.checked) {
                botMove();
            }
          }, 600);
          handEl.style.display = "none";
          return; // End sowing as an extra turn occurred
        }
      }
      p = 1 - p; // Switch to the other player's side
      i = -1; // Reset index to start from 0 on the new row in the next iteration
    } else {
      // Landed in a regular pit
      pits[p][i]++; // Add a stone to the pit
      stonesInHand--; // Decrement stones in hand
      renderBoard(); // Update UI for the pit

      lastP = p;
      lastI = i;

      // Move hand animation to the pit
      const rowEl = p === 0 ? bottomRow.children[i] : topRow.children[6 - i]; // Adjust for top row's reverse rendering
      const rect = rowEl.getBoundingClientRect();
      handEl.style.left = rect.left + "px";
      handEl.style.top = rect.top - 50 + "px";
      handEl.style.display = "block";
      handEl.classList.add("drop");
      setTimeout(() => handEl.classList.remove("drop"), 200);
    }

    setTimeout(dropStone, 500); // Continue sowing after a delay
  };

  dropStone(); // Start the sowing animation
}

// Checks if the game is over and determines the winner
function checkGameOver() {
  const empty0 = pits[0].every(v => v === 0); // Check if Player 1's pits are all empty
  const empty1 = pits[1].every(v => v === 0); // Check if Player 2's pits are all empty

  if (empty0 || empty1) {
    // If one side is empty, collect remaining stones from the other side
    if (!empty0) stores[0] += pits[0].reduce((a, b) => a + b, 0);
    if (!empty1) stores[1] += pits[1].reduce((a, b) => a + b, 0);

    // Set all pits to 0 after collecting for final display
    pits = [Array(7).fill(0), Array(7).fill(0)];
    renderBoard(); // Update the board to show empty pits and final scores

    // Determine winner based on final scores
    if (stores[0] > stores[1]) messageEl.textContent = "Game over! Player 1 wins!";
    else if (stores[1] > stores[0]) messageEl.textContent = "Game over! Player 2 wins!";
    else messageEl.textContent = "Game over! It's a tie!";
    return true; // Game is over
  }
  return false; // Game is not over
}

// Bot's move logic (fetches move from server)
async function botMove() {
  // Only proceed if bot is toggled ON and it's currently bot's turn
  if (!botToggle.checked || isBotThinking) return;

  // Ensure the bot doesn't make a move if the game is already over
  if (checkGameOver()) {
    isBotThinking = false;
    return;
  }

  isBotThinking = true; // Set flag to prevent other interactions
  messageEl.textContent = "Bot is thinking..."; // Inform user

  try {
    const res = await fetch("http://localhost:3000/sungka-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pits, stores, player: 1, level: currentLevel }) // Send current game state and difficulty
    });
    const data = await res.json();
    const chosenPit = data.move;

    // Handle case where server indicates bot has no valid moves (-1)
    if (chosenPit === -1) {
        isBotThinking = false;
        currentPlayer = 0; // Pass turn back to Player 1 (human)
        renderBoard();
        messageEl.textContent = "Bot has no valid moves. Player 1's turn.";
        return;
    }

    // Animate the bot's chosen move after a short delay
    setTimeout(() => {
      isBotThinking = false; // Reset thinking flag
      animateMove(1, chosenPit); // Execute the bot's move
    }, 800);
  } catch (err) {
    console.error("Bot API error:", err);
    isBotThinking = false; // Reset thinking flag
    messageEl.textContent = "Bot API failed. Check server or play vs human.";
    // Fallback if API fails: switch turn to human
    currentPlayer = 0;
    renderBoard();
  }
}


// --- Initialize Game ---
renderBoard(); // Draw the initial board