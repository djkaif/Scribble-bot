/* ... (Keep Elements, State, Join Logic the same) ... */

socket.on("roleUpdate", data => {
  canDraw = data.isDrawer;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (canDraw) {
    wordHint.style.color = "#57f287"; 
    overlayText.textContent = "✏️ YOUR TURN TO DRAW!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
    canvas.style.boxShadow = "0 0 15px #57f287";
    
    // ✅ Disable chat for Drawer
    chatInput.disabled = true;
    chatInput.placeholder = "You are drawing... no spoilers!";
  } else {
    wordHint.style.color = "#fff";
    overlayText.textContent = "🔍 GET READY TO GUESS!";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
    canvas.style.boxShadow = "none";
    
    // ✅ Enable chat for Guessers
    chatInput.disabled = false;
    chatInput.placeholder = "Type your guess...";
  }
});

/* ... (Keep Drawing and Chat Logic the same) ... */
