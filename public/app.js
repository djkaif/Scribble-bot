const socket = io();

/* ELEMENTS */
const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const joinError = document.getElementById("joinError");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const playersList = document.getElementById("players");
const scoresBox = document.getElementById("scores");
const wordHint = document.getElementById("wordHint");
const timerFill = document.getElementById("timerFill");

const overlay = document.getElementById("roundOverlay");
const overlayText = document.getElementById("roundText");

/* SOUNDS */
const sounds = {
  correct: new Audio("/sounds/correct.mp3"),
  round: new Audio("/sounds/round.mp3"),
  join: new Audio("/sounds/join.mp3")
};

let drawing = false;
let canDraw = false;
let tool = "pen";
let color = "#000000";
let undoStack = [];

/* CANVAS */
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.lineWidth = 4;

function resizeCanvas() {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.putImageData(img, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* JOIN LOGIC - FIXED */
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (!code) return;
  
  if (!roomId) {
    joinError.textContent = "❌ No room specified in URL";
    return;
  }

  socket.emit("join", {
    room: roomId, // ✅ Now sending the room ID from the URL
    code: code,   // ✅ Sending the hex code
    user: {
      id: "u" + Math.random().toString(36).substr(2, 9),
      name: "Player_" + Math.floor(Math.random() * 900 + 100)
    }
  });
};

socket.on("joinError", msg => {
  joinError.textContent = msg;
});

socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  canDraw = data.drawer;
  sounds.join.play();
  resizeCanvas(); // Ensure canvas is sized correctly once visible
});

/* DRAWING */
function saveUndo() {
  if (undoStack.length >= 5) undoStack.shift();
  undoStack.push(ctx.getImageData(0,0,canvas.width,canvas.height));
}

canvas.onpointerdown = e => {
  if (!canDraw) return;
  saveUndo();
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  socket.emit("startPath", { x:e.offsetX, y:e.offsetY, color, tool });
};

canvas.onpointermove = e => {
  if (!drawing) return;
  ctx.strokeStyle = tool === "erase" ? "#ffffff" : color;
  ctx.lineWidth = tool === "erase" ? 20 : 4;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  socket.emit("draw", { x:e.offsetX, y:e.offsetY });
};

canvas.onpointerup = () => {
  drawing = false;
  socket.emit("endPath");
};

/* SYNC */
socket.on("startPath", p => {
  ctx.strokeStyle = p.tool === "erase" ? "#ffffff" : p.color;
  ctx.lineWidth = p.tool === "erase" ? 20 : 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

socket.on("draw", p => {
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

socket.on("endPath", () => {
  ctx.closePath();
});

/* GAME EVENTS */
socket.on("players", list => {
  playersList.innerHTML = "";
  list.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersList.appendChild(li);
  });
});

socket.on("scores", scores => {
  scoresBox.innerHTML = "";
  Object.entries(scores).forEach(([id, score]) => {
    scoresBox.innerHTML += `Player: ${score}pts<br>`;
  });
});

socket.on("hint", h => wordHint.textContent = h);

socket.on("timer", t => {
  timerFill.style.width = (t / 90) * 100 + "%";
});

socket.on("system", msg => {
  sounds.correct.play();
  overlayText.textContent = msg;
  overlay.classList.remove("hidden");
  setTimeout(() => overlay.classList.add("hidden"), 3000);
});

socket.on("round", () => {
  sounds.round.play();
  ctx.clearRect(0,0,canvas.width,canvas.height);
});

/* CONTROLS */
document.getElementById("penBtn").onclick = () => tool = "pen";
document.getElementById("eraseBtn").onclick = () => tool = "erase";
document.getElementById("undoBtn").onclick = () => {
  if (!undoStack.length) return;
  ctx.putImageData(undoStack.pop(),0,0);
};

document.getElementById("colorPicker").onchange = e => color = e.target.value;

/* CHAT */
document.getElementById("chatInput").onkeydown = e => {
  if (e.key === "Enter") {
    socket.emit("chat", e.target.value);
    e.target.value = "";
  }
};

document.getElementById("voteSkip").onclick = () => {
  socket.emit("voteSkip");
};
