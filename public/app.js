/* UPDATED JOIN & ROLE LOGIC */
socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  resizeCanvas(); 
});

socket.on("roleUpdate", data => {
  canDraw = data.isDrawer;
  
  // Feedback to user
  if (canDraw) {
    wordHint.style.color = "#57f287"; // Make word green for drawer
    overlayText.textContent = "✏️ YOUR TURN TO DRAW!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
  } else {
    wordHint.style.color = "#fff";
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Guessers start with clean slate
  }
});

/* FIX: Ensure chat is visible */
socket.on("chat", data => {
  const div = document.createElement("div");
  div.style.padding = "2px 0";
  div.innerHTML = `<span style="color: #5865f2"><strong>${data.user}:</strong></span> ${data.text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
