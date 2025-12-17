const socket = io();

const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const joinError = document.getElementById("joinError");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const playersList = document.getElementById("players");
const wordHint = document.getElementById("wordHint");
const timerFill = document.getElementById("timerFill");

let drawing = false;
let undoStack = [];
let canDraw = false;
let color = "#000000";

/* ---------------- JOIN ---------------- */

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (!code) return;

  socket.emit("join", {
    code,
    user: {
      id: Math.random().toString(36),
      name: "discord display (@discord)"
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
  resizeCanvas();
});

/* ---------------- CANVAS ---------------- */

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

canvas.addEventListener("mousedown", e => {
  if (!canDraw) return;
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  socket.emit("startPath", { x: e.offsetX, y: e.offsetY, color });
});

canvas.addEventListener("mousemove", e => {
  if (!drawing) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  socket.emit("draw", { x: e.offsetX, y: e.offsetY });
});

canvas.addEventListener("mouseup", () => {
  drawing = false;
  socket.emit("endPath");
});

/* ---------------- SYNC ---------------- */

socket.on("startPath", p => {
  ctx.strokeStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

socket.on("draw", p => {
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

/* ---------------- GAME ---------------- */

socket.on("players", list => {
  playersList.innerHTML = "";
  list.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersList.appendChild(li);
  });
});

socket.on("hint", hint => {
  wordHint.textContent = hint;
});

socket.on("timer", t => {
  timerFill.style.width = (t / 90) * 100 + "%";
});

/* ---------------- CHAT ---------------- */

document.getElementById("chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    socket.emit("chat", e.target.value);
    e.target.value = "";
  }
});

/* ---------------- CONTROLS ---------------- */

document.getElementById("colorPicker").onchange = e => {
  color = e.target.value;
  ctx.strokeStyle = color;
};

document.getElementById("voteSkip").onclick = () => {
  socket.emit("voteSkip");
};
