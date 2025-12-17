const socket = io(); 

/* 1. ELEMENTS - Must be at the top! */
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
const chatMessages = document.getElementById("messages"); 
const chatInput = document.getElementById("chatInput");

const overlay = document.getElementById("roundOverlay");
const overlayText = document.getElementById("roundText");

/* 2. STATE */
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

/* 3. JOIN LOGIC */
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (!code) {
    joinError.textContent = "Please enter a code!";
    return;
  }
  if (!roomId) {
    joinError.textContent = "URL is missing room ID!";
    return;
  }
  console.log("Attempting to join...");
  socket.emit("join", { room: roomId, code: code });
};

socket.on("joinError", msg => {
  joinError.textContent = msg;
});

socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  resizeCanvas(); 
});

/* 4. ROLE & GAME LOGIC */
socket.on("roleUpdate", data => {
  canDraw = data.isDrawer;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (canDraw) {
    wordHint.style.color = "#57f287"; 
    overlayText.textContent = "✏️ YOUR TURN TO DRAW!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
    canvas.style.boxShadow = "0 0 15px #57f287";
  } else {
    wordHint.style.color = "#fff";
    overlayText.textContent = "🔍 GET READY TO GUESS!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
    canvas.style.boxShadow = "none";
  }
});

socket.on("hint", h => { wordHint.textContent = h; });
socket.on("timer", t => { timerFill.style.width = (t / 90) * 100 + "%"; });

socket.on("players", list => {
  playersList.innerHTML = list.map(p => `<li>${p.name}</li>`).join("");
});

socket.on("scores", scores => {
  scoresBox.innerHTML = Object.entries(scores)
    .map(([id, score]) => `<div>${score} pts</div>`).join("");
});

socket.on("chat", data => {
  const div = document.createElement("div");
  div.style.padding = "4px 0";
  div.innerHTML = `<span style="color: #5865f2"><strong>${data.user}:</strong></span> ${data.text}`;
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

/* 5. DRAWING INPUTS */
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

/* 6. UI CONTROLS */
chatInput.onkeydown = e => {
  if (e.key === "Enter" && e.target.value.trim()) {
    socket.emit("chat", e.target.value);
    e.target.value = "";
  }
};

document.getElementById("penBtn").onclick = () => { tool = "pen"; };
document.getElementById("eraseBtn").onclick = () => { tool = "erase"; };
document.getElementById("colorPicker").onchange = e => { color = e.target.value; };
