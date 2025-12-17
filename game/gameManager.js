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

    // Iterate through every player in the room
    g.players.forEach((user, socketId) => {
      const isDrawer = socketId === g.realDrawerSocket;
      const targetSocket = io.sockets.sockets.get(socketId);
      
      if (targetSocket) {
        // 1. Tell them if they can draw
        targetSocket.emit("roleUpdate", { isDrawer });
        
        // 2. Send the word (Full word for drawer, Masked for guessers)
        const displayWord = isDrawer ? g.word : maskWord(g.word, g.revealed);
        targetSocket.emit("hint", displayWord);
      }
    });
  }

  function nextRound(room) {
    const g = games.get(room);
    if (!g) return;
    
    // Pick next drawer
    const playerIds = Array.from(g.players.keys());
    const currentIndex = playerIds.indexOf(g.realDrawerSocket);
    g.realDrawerSocket = playerIds[(currentIndex + 1) % playerIds.length];

    g.word = getRandomWord();
    g.revealed.clear();
    g.timeLeft = RULES.ROUND_TIME;
    
    io.to(room).emit("round"); // Clear canvases
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

    // Initial drawer assignment
    if (!g.realDrawerSocket || validation.userId === g.drawerId) {
       g.realDrawerSocket = socket.id;
    }

    // Join complete
    socket.emit("init", { players: [...g.players.values()] });
    
    // Refresh everyone's view
    io.to(room).emit("players", [...g.players.values()]);
    io.to(room).emit("scores", Object.fromEntries(g.scores));
    syncRolesAndWord(room);
  }

  function handleChat(socket, msg) {
    const room = Array.from(socket.rooms)[1];
    const g = games.get(room);
    if (!g || !msg) return;

    const p = g.players.get(socket.id);
    if (!p) return;

    if (socket.id !== g.realDrawerSocket && msg.toLowerCase().trim() === g.word.toLowerCase()) {
      g.scores.set(socket.id, (g.scores.get(socket.id) || 0) + 50);
      io.to(room).emit("system", `🎉 ${p.name} guessed the word: ${g.word}!`);
      io.to(room).emit("scores", Object.fromEntries(g.scores));
      nextRound(room);
    } else {
      io.to(room).emit("chat", { user: p.name, text: msg });
    }
  }

  function handleDisconnect(socket) {
    for (const [room, g] of games) {
      if (g.players.has(socket.id)) {
        g.players.delete(socket.id);
        if (g.realDrawerSocket === socket.id) nextRound(room);
        io.to(room).emit("players", [...g.players.values()]);
        break;
      }
    }
  }

  setInterval(() => {
    for (const [room, g] of games) {
      if (g.players.size > 0) {
        g.timeLeft--;
        io.to(room).emit("timer", g.timeLeft);
        if (g.timeLeft <= 0) nextRound(room);
      }
    }
  }, 1000);

  return {
    createGame,
    handleJoin,
    handleChat,
    handleDisconnect,
    handleDraw: (s, d) => s.to(Array.from(s.rooms)[1]).emit("draw", d),
    handleStartPath: (s, p) => s.to(Array.from(s.rooms)[1]).emit("startPath", p),
    handleEndPath: s => s.to(Array.from(s.rooms)[1]).emit("endPath"),
    handleVoteSkip: (socket) => nextRound(Array.from(socket.rooms)[1])
  };
}
