import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";
import crypto from "crypto";

export function createGameManager(io) {
  const games = new Map();

  function createGame({ channelId, drawerId }) {
    const id = crypto.randomUUID();
    const game = {
      id,
      channelId,
      drawerId,
      players: new Map(),
      word: getRandomWord(),
      revealed: new Set(),
      votes: new Set(),
      timeLeft: RULES.ROUND_TIME
    };

    games.set(id, game);
    return game;
  }

  function handleJoin(socket, { room, code, user }) {
    const game = games.get(room);
    if (!game) return socket.emit("joinError", "Game not found");
    if (game.players.size >= RULES.MAX_PLAYERS)
      return socket.emit("joinError", "Game full");

    game.players.set(socket.id, { id: user.id, name: user.name });
    socket.join(room);

    if (!game.drawerId) game.drawerId = user.id;

    socket.emit("init", {
      drawer: user.id === game.drawerId,
      players: [...game.players.values()],
      time: game.timeLeft
    });

    io.to(room).emit("players", [...game.players.values()]);
  }

  function handleChat(socket, msg) {
    const room = [...socket.rooms][1];
    const game = games.get(room);
    if (!game) return;

    const player = game.players.get(socket.id);
    if (!player) return;

    if (player.id !== game.drawerId && msg.toLowerCase() === game.word) {
      io.to(room).emit("system", `${player.name} guessed the word!`);
      nextRound(room);
    } else {
      io.to(room).emit("chat", { user: player.name, text: msg });
    }
  }

  function handleVoteSkip(socket) {
    const room = [...socket.rooms][1];
    const game = games.get(room);
    if (!game) return;

    const player = game.players.get(socket.id);
    if (!player || player.id === game.drawerId) return;

    game.votes.add(player.id);
    const needed = Math.ceil((game.players.size - 1) / 2);
    if (game.votes.size >= needed) nextRound(room);
  }

  function nextRound(room) {
    const game = games.get(room);
    if (!game) return;

    game.word = getRandomWord();
    game.revealed.clear();
    game.votes.clear();
    game.timeLeft = RULES.ROUND_TIME;

    io.to(room).emit("round", {
      hint: maskWord(game.word, game.revealed)
    });
  }

  setInterval(() => {
    for (const [room, game] of games) {
      game.timeLeft--;
      io.to(room).emit("timer", game.timeLeft);

      if (game.timeLeft % RULES.HINT_INTERVAL === 0) {
        const hidden = [...game.word]
          .map((_, i) => i)
          .filter(i => !game.revealed.has(i));
        if (hidden.length) {
          game.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
          io.to(room).emit("hint", maskWord(game.word, game.revealed));
        }
      }

      if (game.timeLeft <= 0) nextRound(room);
    }
  }, 1000);

  return {
    baseUrl: process.env.BASE_URL,
    createGame,
    handleJoin,
    handleChat,
    handleVoteSkip,
    handleDraw: (s, d) => s.to([...s.rooms][1]).emit("draw", d),
    handleStartPath: (s, p) => s.to([...s.rooms][1]).emit("startPath", p),
    handleEndPath: s => s.to([...s.rooms][1]).emit("endPath"),
    handleDisconnect: () => {}
  };
}
