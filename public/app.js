// ✅ 1. Connect with the correct URL logic
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
const chatMessages = document.getElementById("chatMessages"); // Ensure this ID exists in HTML
const chatInput = document.getElementById("chatInput");

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

/* CANVAS RESIZING */
function resizeCanvas() {
  // Store current drawing before resize
  const tempImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.putImageData(tempImg, 0, 0);
  
  // Re-set styles (styles reset when width/height change)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* JOIN LOGIC */
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (!code) return;
  if (!roomId) {
    joinError.textContent = "❌ Missing Room ID in URL";
    return;
  }
  socket.emit("join", { room: roomId, code: code });
};

socket.on("joinError", msg => {
  joinError.textContent = msg;
});

socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  canDraw = data.drawer;
  sounds.join.play();
  resizeCanvas(); 
});

/* DRAWING SYNC */
canvas.onpointerdown = e => {
  if (!canDraw) return;
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  socket.emit("startPath", { x: e.offsetX, y: e.offsetY, color, tool });
};

canvas.onpointermove = e => {
  if (!drawing || !canDraw) return;
  const x = e.offsetX;
  const y = e.offsetY;
  
  ctx.strokeStyle = tool === "erase" ? "#ffffff" : color;
  ctx.lineWidth = tool === "erase" ? 20 : 4;
  ctx.lineTo(x, y);
  ctx.stroke();
  socket.emit("draw", { x, y });
};

canvas.onpointerup = () => {
  drawing = false;
  socket.emit("endPath");
};

// Receiving from others
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

/* GAMEPLAY UPDATES */
socket.on("hint", h => { wordHint.textContent = h; });

socket.on("timer", t => {
  timerFill.style.width = (t / 90) * 100 + "%";
});

socket.on("players", list => {
  playersList.innerHTML = list.map(p => `<li>${p.name}</li>`).join("");
});

socket.on("scores", scores => {
  scoresBox.innerHTML = Object.entries(scores)
    .map(([id, score]) => `<div>${score} pts</div>`).join("");
});

socket.on("chat", data => {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("system", msg => {
  sounds.correct.play();
  overlayText.textContent = msg;
  overlay.classList.remove("hidden");
  setTimeout(() => overlay.classList.add("hidden"), 3000);
});

socket.on("round", () => {
  sounds.round.play();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

/* UI CONTROLS */
chatInput.onkeydown = e => {
  if (e.key === "Enter" && e.target.value.trim()) {
    socket.emit("chat", e.target.value);
    e.target.value = "";
  }
};
      
