import crypto from "crypto";
import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";

export function createGameManager(io) {
  const games = new Map();

  function createGame({ channelId, drawerId }) {
    const id = crypto.randomUUID();
    games.set(id, {
      id,
      channelId,
      drawerId,
      players: new Map(),
      scores: new Map(),
      lastActive: new Map(),
      word: getRandomWord(),
      revealed: new Set(),
      votes: new Set(),
      timeLeft: RULES.ROUND_TIME
    });
    return games.get(id);
  }

  function handleJoin(socket, { room, user }) {
    const g = games.get(room);
    if (!g) return socket.emit("joinError", "Game expired");
    if (g.players.size >= RULES.MAX_PLAYERS)
      return socket.emit("joinError", "Game full");

    g.players.set(socket.id, user);
    g.scores.set(user.id, g.scores.get(user.id) || 0);
    g.lastActive.set(socket.id, Date.now());
    socket.join(room);

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

    g.lastActive.set(socket.id, Date.now());
    const p = g.players.get(socket.id);
    if (!p) return;

    if (p.id !== g.drawerId && msg.toLowerCase() === g.word) {
      g.scores.set(p.id, g.scores.get(p.id) + 10);
      io.to(room).emit("system", `🎉 ${p.name} guessed it!`);
      io.to(room).emit("scores", Object.fromEntries(g.scores));
      nextRound(room);
    } else {
      io.to(room).emit("chat", { user: p.name, text: msg });
    }
  }

  function nextRound(room) {
    const g = games.get(room);
    g.word = getRandomWord();
    g.revealed.clear();
    g.votes.clear();
    g.timeLeft = RULES.ROUND_TIME;
    io.to(room).emit("round");
    io.to(room).emit("hint", maskWord(g.word, g.revealed));
  }

  setInterval(() => {
    for (const [room, g] of games) {
      g.timeLeft--;
      io.to(room).emit("timer", g.timeLeft);
      if (g.timeLeft <= 0) nextRound(room);

      if (!g.players.size) games.delete(room);
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
    handleDisconnect: ()=>{}
  };
}
