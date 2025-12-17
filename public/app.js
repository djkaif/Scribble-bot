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
const chatMessages = document.getElementById("messages"); // ✅ Matches HTML
const chatInput = document.getElementById("chatInput");

const overlay = document.getElementById("roundOverlay");
const overlayText = document.getElementById("roundText");

/* SETTINGS */
let drawing = false;
let canDraw = false;
let tool = "pen";
let color = "#000000";

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

window.addEventListener("resize", resizeCanvas);

/* JOIN */
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (!code || !roomId) return;
  socket.emit("join", { room: roomId, code: code });
};

socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  canDraw = data.drawer;
  resizeCanvas(); 
});

socket.on("joinError", msg => { joinError.textContent = msg; });

/* DRAWING */
canvas.onpointerdown = e => {
  if (!canDraw) return;
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  socket.emit("startPath", { x: e.offsetX, y: e.offsetY, color, tool });
};

canvas.onpointermove = e => {
  if (!drawing || !canDraw) return;
  ctx.strokeStyle = tool === "erase" ? "#ffffff" : color;
  ctx.lineWidth = tool === "erase" ? 20 : 4;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  socket.emit("draw", { x: e.offsetX, y: e.offsetY });
};

canvas.onpointerup = () => {
  drawing = false;
  socket.emit("endPath");
};

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

socket.on("endPath", () => ctx.closePath());

/* UPDATES */
socket.on("hint", h => { wordHint.textContent = h; });
socket.on("timer", t => { timerFill.style.width = (t / 90) * 100 + "%"; });

socket.on("players", list => {
  playersList.innerHTML = list.map(p => `<li>${p.name}</li>`).join("");
});

socket.on("chat", data => {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("system", msg => {
  overlayText.textContent = msg;
  overlay.classList.remove("hidden");
  setTimeout(() => overlay.classList.add("hidden"), 3000);
});

socket.on("round", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

/* CONTROLS */
chatInput.onkeydown = e => {
  if (e.key === "Enter" && e.target.value.trim()) {
    socket.emit("chat", e.target.value);
    e.target.value = "";
  }
};

document.getElementById("penBtn").onclick = () => { tool = "pen"; };
document.getElementById("eraseBtn").onclick = () => { tool = "erase"; };
document.getElementById("colorPicker").onchange = e => { color = e.target.value; };
