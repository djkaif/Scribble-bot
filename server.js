import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { createGameManager } from "./game/gameManager.js";
import { createCodeManager } from "./game/codeManager.js";
import { startDiscordBot } from "./discordBot.js";

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. Initialize Managers
// createCodeManager handles the hex codes and Discord user names
const codeManager = createCodeManager();

// createGameManager handles rooms, drawing, and scoring
const gameManager = createGameManager(io, codeManager); 

// ✅ 2. Start Discord Bot with shared managers
// This allows the bot to store names in codeManager and create games in gameManager
startDiscordBot(gameManager, codeManager);

// ✅ 3. Socket.io Event Handling
io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Joining the room with the Hex Code
  socket.on("join", (data) => gameManager.handleJoin(socket, data));

  // Drawing Events
  socket.on("startPath", (p) => gameManager.handleStartPath(socket, p));
  socket.on("draw", (data) => gameManager.handleDraw(socket, data));
  socket.on("endPath", () => gameManager.handleEndPath(socket));

  // Game Logic Events
  socket.on("chat", (msg) => gameManager.handleChat(socket, msg));
  socket.on("voteSkip", () => gameManager.handleVoteSkip(socket));

  // Cleanup on leave
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    gameManager.handleDisconnect(socket);
  });
});

// ✅ 4. Start Server
server.listen(PORT, () => {
  console.log(`🚀 Scribble Server running on http://localhost:${PORT}`);
});
