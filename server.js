import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { createGameManager } from "./game/gameManager.js";
import { createCodeManager } from "./game/codeManager.js";
import { startDiscordBot } from "./discordBot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
// ✅ Capture the Render URL from Environment Variables
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.static(path.join(__dirname, "public")));

const codeManager = createCodeManager();

// ✅ Pass BASE_URL to the Game Manager
const gameManager = createGameManager(io, codeManager, BASE_URL); 

startDiscordBot(gameManager, codeManager);

io.on("connection", (socket) => {
  socket.on("join", (data) => gameManager.handleJoin(socket, data));
  socket.on("startPath", (p) => gameManager.handleStartPath(socket, p));
  socket.on("draw", (data) => gameManager.handleDraw(socket, data));
  socket.on("endPath", () => gameManager.handleEndPath(socket));
  socket.on("chat", (msg) => gameManager.handleChat(socket, msg));
  socket.on("voteSkip", () => gameManager.handleVoteSkip(socket));
  socket.on("disconnect", () => gameManager.handleDisconnect(socket));
});

server.listen(PORT, () => {
  console.log(`🚀 Scribble Server running on port ${PORT}`);
  console.log(`🔗 Base URL set to: ${BASE_URL}`);
});
