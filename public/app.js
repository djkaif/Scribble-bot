/* UPDATED JOIN & ROLE LOGIC */
socket.on("init", data => {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  resizeCanvas(); 
});

socket.on("roleUpdate", data => {
  canDraw = data.isDrawer;
  
  // ✅ IMPORTANT: Always clear the canvas for EVERYONE when roles change
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Feedback to user
  if (canDraw) {
    wordHint.style.color = "#57f287"; // Green for drawer
    overlayText.textContent = "✏️ YOUR TURN TO DRAW!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
    
    // Optional: Add a visual cue to the canvas border
    canvas.style.boxShadow = "0 0 15px #57f287";
  } else {
    wordHint.style.color = "#fff"; // White for guessers
    overlayText.textContent = "🔍 GET READY TO GUESS!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
    
    canvas.style.boxShadow = "none";
  }
});

/* CHAT & SYSTEM FEEDBACK */
socket.on("chat", data => {
  const div = document.createElement("div");
  div.style.padding = "4px 0";
  div.style.borderBottom = "1px solid #2b2d31";
  div.innerHTML = `<span style="color: #5865f2"><strong>${data.user}:</strong></span> ${data.text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ✅ MUST ADD: Listener for when a round starts to clear drawing
socket.on("round", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
