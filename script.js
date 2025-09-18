const INITIAL_STONES = 7;
let pits = [Array(7).fill(INITIAL_STONES), Array(7).fill(INITIAL_STONES)];
let stores = [0, 0];
let currentPlayer = 0;
let isBotThinking = false;
let currentLevel = "medium";

// --- DOM
const topRow = document.getElementById("top-row");
const bottomRow = document.getElementById("bottom-row");
const store0El = document.getElementById("store0");
const store1El = document.getElementById("store1");
const currentEl = document.getElementById("current");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("reset");
const botToggle = document.getElementById("botToggle");
const difficultySelect = document.getElementById("difficulty");

// 👉 hand element
const handEl = document.createElement("div");
handEl.id = "hand";
document.body.appendChild(handEl);

// CSS for hand (basic)
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

// difficulty select
difficultySelect.addEventListener("change", () => {
  currentLevel = difficultySelect.value;
});

// Render board UI
function renderBoard() {
  topRow.innerHTML = "";
  bottomRow.innerHTML = "";

  for (let i = 6; i >= 0; i--) {
    topRow.appendChild(createPit(1, i));
  }

  for (let i = 0; i < 7; i++) {
    bottomRow.appendChild(createPit(0, i));
  }

  store0El.textContent = stores[0];
  store1El.textContent = stores[1];
  currentEl.textContent = currentPlayer === 0 ? "Player 1" : "Player 2";
}

function createPit(player, idx) {
  const pitEl = document.createElement("div");
  pitEl.className = "pit";

  const stonesContainer = document.createElement("div");
  stonesContainer.className = "stones";

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

  const isHumanTurn = !(currentPlayer === 1 && botToggle.checked);
  const isClickable = player === currentPlayer && pits[player][idx] > 0 && isHumanTurn && !isBotThinking;

  if (isClickable) {
    pitEl.addEventListener("click", () => animateMove(player, idx));
  } else {
    pitEl.classList.add("disabled");
  }

  return pitEl;
}

// --- Animate sowing stones with hand ---
function animateMove(player, idx) {
  if (player !== currentPlayer || isBotThinking) return;
  if (pits[player][idx] === 0) return;

  messageEl.textContent = "";

  let stones = pits[player][idx];
  pits[player][idx] = 0;
  renderBoard();

  let p = player;
  let i = idx;
  let lastP = null;
  let lastI = null;

  const dropStone = () => {
    if (stones === 0) {
      // Done sowing → capture & turn check
      if (lastP === player && typeof lastI === "number" && pits[lastP][lastI] === 1) {
        const opposite = 6 - lastI;
        const captured = pits[1 - lastP][opposite];
        if (captured > 0) {
          stores[player] += captured + 1;
          pits[lastP][lastI] = 0;
          pits[1 - lastP][opposite] = 0;
          messageEl.textContent = `Capture! Player ${player + 1} captured ${captured} stones.`;
        }
      }
      currentPlayer = 1 - currentPlayer;
      renderBoard();
      checkGameOver();
      if (currentPlayer === 1 && botToggle.checked) setTimeout(botMove, 800);
      handEl.style.display = "none";
      return;
    }

    i++;
    if (i === 7) {
      if (p === player) {
        stores[player]++;
        stones--;
        renderBoard();
        lastP = "store";

        // Move hand to store
        const storeEl = player === 0 ? store0El : store1El;
        const rect = storeEl.getBoundingClientRect();
        handEl.style.left = rect.left + "px";
        handEl.style.top = rect.top - 50 + "px";
        handEl.style.display = "block";
        handEl.classList.add("drop");
        setTimeout(() => handEl.classList.remove("drop"), 200);

        if (stones === 0) {
          messageEl.textContent = "Extra turn!";
          renderBoard();
          setTimeout(() => {
            if (currentPlayer === 1 && botToggle.checked) botMove();
          }, 600);
          handEl.style.display = "none";
          return;
        }
      }
      p = 1 - p;
      i = -1;
    } else {
      pits[p][i]++;
      stones--;
      renderBoard();
      lastP = p;
      lastI = i;

      // Move hand to pit
      const rowEl = p === 0 ? bottomRow.children[i] : topRow.children[6 - i];
      const rect = rowEl.getBoundingClientRect();
      handEl.style.left = rect.left + "px";
      handEl.style.top = rect.top - 50 + "px";
      handEl.style.display = "block";
      handEl.classList.add("drop");
      setTimeout(() => handEl.classList.remove("drop"), 200);
    }

    setTimeout(dropStone, 500);
  };

  dropStone();
}

function checkGameOver() {
  const empty0 = pits[0].every(v => v === 0);
  const empty1 = pits[1].every(v => v === 0);
  if (empty0 || empty1) {
    if (!empty0) stores[0] += pits[0].reduce((a, b) => a + b, 0);
    if (!empty1) stores[1] += pits[1].reduce((a, b) => a + b, 0);
    pits = [Array(7).fill(0), Array(7).fill(0)];
    renderBoard();
    if (stores[0] > stores[1]) messageEl.textContent = "Game over! Player 1 wins!";
    else if (stores[1] > stores[0]) messageEl.textContent = "Game over! Player 2 wins!";
    else messageEl.textContent = "Game over! It's a tie!";
    return true;
  }
  return false;
}

// Bot move (unchanged, uses animateMove instead of move)
async function botMove() {
  if (!botToggle.checked || isBotThinking) return;
  const validMoves = pits[1].map((s, i) => (s > 0 ? i : null)).filter(i => i !== null);
  if (validMoves.length === 0) {
    currentPlayer = 0;
    renderBoard();
    return;
  }
  isBotThinking = true;
  messageEl.textContent = "Bot is thinking...";
  try {
    const res = await fetch("http://localhost:3000/sungka-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pits, stores, player: 1, level: currentLevel })
    });
    const data = await res.json();
    const chosenPit = data.move;
    setTimeout(() => {
      isBotThinking = false;
      animateMove(1, chosenPit);
    }, 800);
  } catch (err) {
    console.error("Bot error:", err);
    isBotThinking = false;
    messageEl.textContent = "Bot failed. Play vs human.";
    currentPlayer = 0;
    renderBoard();
  }
}

// Reset
resetBtn.addEventListener("click", () => {
  pits = [Array(7).fill(INITIAL_STONES), Array(7).fill(INITIAL_STONES)];
  stores = [0, 0];
  currentPlayer = 0;
  isBotThinking = false;
  messageEl.textContent = "";
  renderBoard();
});

botToggle.addEventListener("change", () => {
  if (botToggle.checked && currentPlayer === 1) setTimeout(botMove, 400);
});

renderBoard();
