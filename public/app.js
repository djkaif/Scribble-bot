/* JOIN LOGIC */
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

joinBtn.onclick = () => {
  const code = codeInput.value.trim();
  if (!code || !roomId) return;

  // ✅ Only send room and hex code
  socket.emit("join", { room: roomId, code: code });
};

socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  canDraw = data.drawer;
  sounds.join.play();
  resizeCanvas();
});

// ... (Rest of drawing and socket events remain the same)
