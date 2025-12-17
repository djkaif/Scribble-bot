import crypto from "crypto";
import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";

// ✅ Now accepts shared codeManager
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
      lastActive: new Map(),
      createdAt: Date.now(), // ✅ Safety timestamp
      word: getRandomWord(),
      revealed: new Set(),
      votes: new Set(),
      timeLeft: RULES.ROUND_TIME
    };
    games.set(id, newGame);
    return newGame;
  }

  function handleJoin(socket, { room, user, code }) {
    const g = games.get(room);
    
    // Check if game exists
    if (!g) return socket.emit("joinError", "Game not found");

    // ✅ VALIDATE THE HEX CODE
    const validation = codeManager.consumeCode(code, user.id);
    if (!validation.ok) {
      return socket.emit("joinError", validation.reason);
    }

    // Check if full
    if (g.players.size >= RULES.MAX_PLAYERS)
      return socket.emit("joinError", "Game full");

    // Add player
    g.players.set(socket.id, user);
    g.scores.set(user.id, g.scores.get(user.id) || 0);
    g.lastActive.set(socket.id, Date.now());
    socket.join(room);

    // Auto-assign drawer if none
    if (!g.drawerId) g.drawerId = user.id;

    socket.emit("init", {
      drawer: user.id === g.drawerId,
      scores: Object.fromEntries(g.scores)
    });

    io.to(room).emit("players", [...g.players.values()]);
    io.to(room).emit("scores", Object.fromEntries(g.scores));
  }

  function handleChat(socket, msg) {
    const room = [...socket.rooms][1];
    const g = games.get(room);
    if (!g) return;

    const p = g.players.get(socket.id);
    if (!p) return;

    if (p.id !== g.drawerId && msg.toLowerCase().trim() === g.word.toLowerCase()) {
      g.scores.set(p.id, (g.scores.get(p.id) || 0) + 10);
      io.to(room).emit("system", `🎉 ${p.name} guessed the word!`);
      io.to(room).emit("scores", Object.fromEntries(g.scores));
      nextRound(room);
    } else {
      io.to(room).emit("chat", { user: p.name, text: msg });
    }
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

  setInterval(() => {
    const now = Date.now();
    for (const [room, g] of games) {
      g.timeLeft--;
      io.to(room).emit("timer", g.timeLeft);
      
      if (g.timeLeft <= 0) nextRound(room);

      // ✅ FIXED CLEANUP: 
      // Only delete if it's empty AND it has been at least 2 minutes since it was created
      const age = now - g.createdAt;
      if (g.players.size === 0 && age > 120000) { 
        games.delete(room);
      }
    }
  }, 1000);

  return {
    baseUrl: process.env.BASE_URL,
    createGame,
    handleJoin,
    handleChat,
    handleDraw: (s,d)=>s.to([...s.rooms][1]).emit("draw",d),
    handleStartPath: (s,p)=>s.to([...s.rooms][1]).emit("startPath",p),
    handleEndPath: s=>s.to([...s.rooms][1]).emit("endPath"),
    handleVoteSkip: ()=>{}, 
    handleDisconnect: (socket)=> {
        const room = [...socket.rooms][1];
        const g = games.get(room);
        if(g) {
            g.players.delete(socket.id);
            io.to(room).emit("players", [...g.players.values()]);
        }
    }
  };
}
