import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { createGameManager } from "./game/gameManager.js";
import { createCodeManager } from "./game/codeManager.js"; // Import this
import { startDiscordBot } from "./discordBot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// ✅ Create ONE shared instance
const codeManager = createCodeManager();
const gameManager = createGameManager(io, codeManager); // Pass to Manager

// ✅ Pass shared instance to Bot
startDiscordBot(gameManager, codeManager);

io.on("connection", socket => {
  socket.on("join", data => gameManager.handleJoin(socket, data));
  socket.on("draw", data => gameManager.handleDraw(socket, data));
  socket.on("startPath", p => gameManager.handleStartPath(socket, p));
  socket.on("endPath", () => gameManager.handleEndPath(socket));
  socket.on("chat", msg => gameManager.handleChat(socket, msg));
  socket.on("voteSkip", () => gameManager.handleVoteSkip(socket));
  socket.on("disconnect", () => gameManager.handleDisconnect(socket));
});

server.listen(PORT, () => console.log("Server running on", PORT));
