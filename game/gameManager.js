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
      drawerId, // This is the Discord ID from the /start command
      realDrawerSocket: null, // We will map the socket here on join
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

  function nextRound(room) {
    const g = games.get(room);
    if (!g) return;
    
    g.word = getRandomWord();
    g.revealed.clear();
    g.votes.clear();
    g.timeLeft = RULES.ROUND_TIME;
    
    io.to(room).emit("round");
    io.to(room).emit("hint", maskWord(g.word, g.revealed));
  }

  function handleJoin(socket, { room, code }) {
    const g = games.get(room);
    if (!g) return socket.emit("joinError", "Game not found");

    const validation = codeManager.consumeCode(code);
    if (!validation.ok) return socket.emit("joinError", validation.reason);

    if (g.players.size >= RULES.MAX_PLAYERS) return socket.emit("joinError", "Game full");

    const user = { id: socket.id, name: validation.displayName };
    g.players.set(socket.id, user);
    g.scores.set(socket.id, 0);
    socket.join(room);

    // Logic: If the person joining is the one tagged in Discord, make them drawer
    // Otherwise, if no one is drawing yet, make the first person the drawer
    if (!g.realDrawerSocket || validation.userId === g.drawerId) {
       g.realDrawerSocket = socket.id;
    }

    // ✅ SEND INIT DATA (This triggers the screen change)
    socket.emit("init", { 
        drawer: socket.id === g.realDrawerSocket, 
        players: [...g.players.values()] 
    });

    // ✅ SEND CURRENT STATE
    socket.emit("hint", maskWord(g.word, g.revealed));
    io.to(room).emit("players", [...g.players.values()]);
    io.to(room).emit("scores", Object.fromEntries(g.scores));
  }

  function handleChat(socket, msg) {
    const room = [...socket.rooms][1];
    const g = games.get(room);
    if (!g || !msg) return;

    const p = g.players.get(socket.id);
    if (!p) return;

    // Check if guess is correct
    if (socket.id !== g.realDrawerSocket && msg.toLowerCase().trim() === g.word.toLowerCase()) {
      g.scores.set(socket.id, (g.scores.get(socket.id) || 0) + 10);
      io.to(room).emit("system", `🎉 ${p.name} guessed the word!`);
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
        g.scores.delete(socket.id);
        if (g.realDrawerSocket === socket.id) g.realDrawerSocket = null;
        
        io.to(room).emit("players", [...g.players.values()]);
        
        // If room is empty, it will be cleaned up by the interval
        break;
      }
    }
  }

  // GAME LOOP
  setInterval(() => {
    const now = Date.now();
    for (const [room, g] of games) {
      if (g.players.size > 0) {
        g.timeLeft--;
        io.to(room).emit("timer", g.timeLeft);
        if (g.timeLeft <= 0) nextRound(room);
      } else if (now - g.createdAt > 300000) { 
        games.delete(room);
      }
    }
  }, 1000);

  return {
    baseUrl: process.env.BASE_URL,
    createGame,
    handleJoin,
    handleChat,
    handleDisconnect,
    handleDraw: (s, d) => s.to([...s.rooms][1]).emit("draw", d),
    handleStartPath: (s, p) => s.to([...s.rooms][1]).emit("startPath", p),
    handleEndPath: s => s.to([...s.rooms][1]).emit("endPath"),
    handleVoteSkip: (socket) => {
        const room = [...socket.rooms][1];
        nextRound(room);
    }
  };
}
