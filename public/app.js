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
const chatMessages = document.getElementById("messages"); 
const chatInput = document.getElementById("chatInput");

/* STATE */
let drawing = false;
let canDraw = false;
let tool = "pen";
let color = "#000000";

function resizeCanvas() {
  if (!canvas || gameScreen.classList.contains("hidden")) return;
  
  // Use offsetWidth/Height for accurate layout sizing
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
}

window.addEventListener("resize", resizeCanvas);

/* JOIN LOGIC */
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (code && roomId) {
    socket.emit("join", { room: roomId, code: code });
  } else {
    joinError.textContent = "Enter code!";
  }
};

socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  // Wait for CSS to apply before sizing canvas
  setTimeout(resizeCanvas, 100); 
});

/* GAMEPLAY */
socket.on("roleUpdate", data => {
  canDraw = data.isDrawer;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  chatInput.disabled = canDraw;
  chatInput.placeholder = canDraw ? "You are drawing..." : "Type your guess...";
});

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

/* DRAWING LOGIC */
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
  ctx.lineWidth = tool === "erase" ? 25 : 4;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  socket.emit("draw", { x: e.offsetX, y: e.offsetY });
};

canvas.onpointerup = () => { drawing = false; socket.emit("endPath"); };

socket.on("startPath", p => {
  ctx.beginPath();
  ctx.strokeStyle = p.tool === "erase" ? "#ffffff" : p.color;
  ctx.lineWidth = p.tool === "erase" ? 25 : 4;
  ctx.moveTo(p.x, p.y);
});

socket.on("draw", p => { ctx.lineTo(p.x, p.y); ctx.stroke(); });

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
