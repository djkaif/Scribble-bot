import crypto from "crypto";
import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";

// ✅ Added baseUrl to parameters
export function createGameManager(io, codeManager, baseUrl) {
  const games = new Map();

  function createGame({ channelId, drawerId }) {
    const id = crypto.randomUUID();
    const newGame = {
      id,
      channelId,
      drawerId, // Discord User ID of the intended drawer
      realDrawerSocket: null,
      players: new Map(),
      scores: new Map(),
      createdAt: Date.now(),
      word: getRandomWord(),
      revealed: new Set(),
      timeLeft: RULES.ROUND_TIME
    };
    games.set(id, newGame);
    return newGame;
  }

  function syncRolesAndWord(room) {
    const g = games.get(room);
    if (!g) return;

    g.players.forEach((user, socketId) => {
      const isDrawer = socketId === g.realDrawerSocket;
      const targetSocket = io.sockets.sockets.get(socketId);
      
      if (targetSocket) {
        targetSocket.emit("roleUpdate", { isDrawer });
        const displayWord = isDrawer ? g.word : maskWord(g.word, g.revealed);
        targetSocket.emit("hint", displayWord);
      }
    });
  }

  function nextRound(room) {
    const g = games.get(room);
    if (!g || g.players.size === 0) return;
    
    const playerIds = Array.from(g.players.keys());
    const currentIndex = playerIds.indexOf(g.realDrawerSocket);
    g.realDrawerSocket = playerIds[(currentIndex + 1) % playerIds.length];

    g.word = getRandomWord();
    g.revealed.clear();
    g.timeLeft = RULES.ROUND_TIME;
    
    io.to(room).emit("round");
    io.to(room).emit("system", "New round started!");
    syncRolesAndWord(room);
  }

  function handleJoin(socket, { room, code }) {
    const g = games.get(room);
    if (!g) return socket.emit("joinError", "Game not found");

    const validation = codeManager.consumeCode(code);
    if (!validation.ok) return socket.emit("joinError", validation.reason);

    const user = { id: socket.id, name: validation.displayName };
    g.players.set(socket.id, user);
    g.scores.set(socket.id, 0);
    socket.join(room);

    // ✅ Match the Discord User ID to the Socket if they were the chosen drawer
    if (!g.realDrawerSocket || validation.userId === g.drawerId) {
       g.realDrawerSocket = socket.id;
    }

    socket.emit("init", { players: [...g.players.values()] });
    io.to(room).emit("players", [...g.players.values()]);
    io.to(room).emit("scores", Object.fromEntries(g.scores));
    
    // Sync roles immediately so drawer sees the word
    syncRolesAndWord(room);
  }

  // ... (Keep handleChat, handleDisconnect, and setInterval as they were)

  return {
    baseUrl, // ✅ This will now be https://scribble-bot.onrender.com
    createGame,
    handleJoin,
    handleChat: (socket, msg) => {
      const room = Array.from(socket.rooms)[1];
      const g = games.get(room);
      if (!g || !msg) return;
      const p = g.players.get(socket.id);
      if (socket.id !== g.realDrawerSocket && msg.toLowerCase().trim() === g.word.toLowerCase()) {
        g.scores.set(socket.id, (g.scores.get(socket.id) || 0) + 50);
        io.to(room).emit("system", `🎉 ${p.name} guessed it: ${g.word}!`);
        io.to(room).emit("scores", Object.fromEntries(g.scores));
        nextRound(room);
      } else {
        io.to(room).emit("chat", { user: p.name, text: msg });
      }
    },
    handleDisconnect: (socket) => {
        for (const [room, g] of games) {
          if (g.players.has(socket.id)) {
            g.players.delete(socket.id);
            if (g.realDrawerSocket === socket.id) nextRound(room);
            io.to(room).emit("players", [...g.players.values()]);
            break;
          }
        }
    },
    handleDraw: (s, d) => s.to(Array.from(s.rooms)[1]).emit("draw", d),
    handleStartPath: (s, p) => s.to(Array.from(s.rooms)[1]).emit("startPath", p),
    handleEndPath: s => s.to(Array.from(s.rooms)[1]).emit("endPath"),
    handleVoteSkip: (socket) => nextRound(Array.from(socket.rooms)[1])
  };
}
