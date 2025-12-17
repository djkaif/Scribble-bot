import crypto from "crypto";
import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";

const AFK_LIMIT = 90; // seconds

export function createGameManager(io) {
  const games = new Map();

  function createGame({ channelId, drawerId }) {
    const id = crypto.randomUUID();
    games.set(id, {
      id,
      channelId,
      drawerId,
      players: new Map(), // socketId -> player
      scores: new Map(),  // userId -> score
      lastActive: new Map(),
      word: getRandomWord(),
      revealed: new Set(),
      votes: new Set(),
      timeLeft: RULES.ROUND_TIME
    });
    return games.get(id);
  }

  function handleJoin(socket, { room, user }) {
    const game = games.get(room);
    if (!game) return socket.emit("joinError", "Game expired");

    game.players.set(socket.id, user);
    game.lastActive.set(socket.id, Date.now());
    game.scores.set(user.id, game.scores.get(user.id) || 0);

    socket.join(room);

    if (!game.drawerId) game.drawerId = user.id;

    socket.emit("init", {
      drawer: user.id === game.drawerId,
      scores: Object.fromEntries(game.scores)
    });

    io.to(room).emit("players", [...game.players.values()]);
    io.to(room).emit("scores", Object.fromEntries(game.scores));
  }

  function handleChat(socket, msg) {
    const room = [...socket.rooms][1];
    const game = games.get(room);
    if (!game) return;

    game.lastActive.set(socket.id, Date.now());

    const player = game.players.get(socket.id);
    if (!player) return;

    if (player.id !== game.drawerId && msg.toLowerCase() === game.word) {
      const score = game.scores.get(player.id) + 10;
      game.scores.set(player.id, score);

      io.to(room).emit("system", `🎉 ${player.name} guessed it!`);
      io.to(room).emit("scores", Object.fromEntries(game.scores));
      nextRound(room);
    } else {
      io.to(room).emit("chat", { user: player.name, text: msg });
    }
  }

  function nextRound(room) {
    const game = games.get(room);
    if (!game) return;

    game.word = getRandomWord();
    game.revealed.clear();
    game.votes.clear();
    game.timeLeft = RULES.ROUND_TIME;

    io.to(room).emit("round");
    io.to(room).emit("hint", maskWord(game.word, game.revealed));
  }

  /* AFK + TIMER */
  setInterval(() => {
    for (const [room, game] of games) {
      game.timeLeft--;
      io.to(room).emit("timer", game.timeLeft);

      if (game.timeLeft <= 0) nextRound(room);

      for (const [sid, last] of game.lastActive) {
        if (Date.now() - last > AFK_LIMIT * 1000) {
          const p = game.players.get(sid);
          game.players.delete(sid);
          game.lastActive.delete(sid);
          if (p) io.to(room).emit("system", `${p.name} was kicked (AFK)`);
        }
      }

      if (!game.players.size) games.delete(room);
    }
  }, 1000);

  return {
    createGame,
    handleJoin,
    handleChat,
    handleDraw: (s,d)=>s.to([...s.rooms][1]).emit("draw",d),
    handleStartPath: (s,p)=>s.to([...s.rooms][1]).emit("startPath",p),
    handleEndPath: s=>s.to([...s.rooms][1]).emit("endPath"),
    handleVoteSkip: ()=>{},
    handleDisconnect: s=>{
      const room=[...s.rooms][1];
      const g=games.get(room);
      if(!g) return;
      g.players.delete(s.id);
      g.lastActive.delete(s.id);
    }
  };
}
