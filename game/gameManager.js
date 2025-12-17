import crypto from "crypto";
import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";

export function createGameManager(io, codeManager) {
  const games = new Map();

  function createGame({ channelId, drawerId }) {
    const id = crypto.randomUUID();
    const newGame = {
      id,
      channelId,
      drawerId,
      players: new Map(),
      scores: new Map(),
      createdAt: Date.now(),
      word: getRandomWord(),
      revealed: new Set(),
      votes: new Set(),
      timeLeft: RULES.ROUND_TIME
    };
    games.set(id, newGame);
    return newGame;
  }

  function handleJoin(socket, { room, code }) {
    const g = games.get(room);
    if (!g) return socket.emit("joinError", "Game not found");

    // ✅ Validation returns the Discord Display Name
    const validation = codeManager.consumeCode(code);
    if (!validation.ok) return socket.emit("joinError", validation.reason);

    if (g.players.size >= RULES.MAX_PLAYERS) return socket.emit("joinError", "Game full");

    // ✅ Set user name from Discord Data
    const user = { id: socket.id, name: validation.displayName };
    g.players.set(socket.id, user);
    g.scores.set(socket.id, 0);
    socket.join(room);

    if (!g.drawerId) g.drawerId = socket.id;

    socket.emit("init", { drawer: socket.id === g.drawerId, players: [...g.players.values()] });
    io.to(room).emit("players", [...g.players.values()]);
  }

  // ... (handleChat, handleDraw, nextRound remains the same as previous fixed versions)

  setInterval(() => {
    const now = Date.now();
    for (const [room, g] of games) {
      g.timeLeft--;
      io.to(room).emit("timer", g.timeLeft);
      if (g.timeLeft <= 0) nextRound(room);
      if (g.players.size === 0 && (now - g.createdAt > 120000)) games.delete(room);
    }
  }, 1000);

  return {
    baseUrl: process.env.BASE_URL,
    createGame,
    handleJoin,
    handleDraw: (s, d) => s.to([...s.rooms][1]).emit("draw", d),
    handleStartPath: (s, p) => s.to([...s.rooms][1]).emit("startPath", p),
    handleEndPath: s => s.to([...s.rooms][1]).emit("endPath"),
    handleChat: (s, m) => { /* standard chat logic */ },
    handleDisconnect: (s) => { /* remove player logic */ }
  };
}
