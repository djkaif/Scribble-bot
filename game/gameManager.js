import crypto from "crypto";
import { RULES } from "./constants.js";
import { getRandomWord, maskWord } from "./wordManager.js";
import { discordInterface } from "../discordBot.js";

export function createGameManager(io, codeManager, baseUrl) {
  const games = new Map();

  function createGame({ channelId, drawerId }) {
    const id = crypto.randomUUID();
    const newGame = {
      id, channelId, drawerId, realDrawerSocket: null,
      players: new Map(), scores: new Map(), createdAt: Date.now(),
      word: getRandomWord(), revealed: new Set(), timeLeft: RULES.ROUND_TIME
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
        targetSocket.emit("hint", isDrawer ? g.word : maskWord(g.word, g.revealed));
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
    const drawerName = g.players.get(g.realDrawerSocket).name;
    discordInterface.send(g.channelId, `✏️ New Round! **${drawerName}** is now drawing!`);
    syncRolesAndWord(room);
  }

  return {
    baseUrl,
    createGame,
    getScoresByChannel: (channelId) => {
      const g = Array.from(games.values()).find(x => x.channelId === channelId);
      if (!g) return null;
      return Array.from(g.players.values()).map(p => `**${p.name}:** ${g.scores.get(p.id) || 0} pts`).join("\n");
    },
    handleJoin: (socket, { room, code }) => {
      const g = games.get(room);
      if (!g) return socket.emit("joinError", "Game not found");
      const validation = codeManager.consumeCode(code);
      if (!validation.ok) return socket.emit("joinError", validation.reason);

      const user = { id: socket.id, name: validation.displayName };
      g.players.set(socket.id, user);
      g.scores.set(socket.id, 0);
      socket.join(room);

      if (!g.realDrawerSocket || validation.userId === g.drawerId) g.realDrawerSocket = socket.id;

      discordInterface.send(g.channelId, `📥 **${user.name}** joined the game!`);
      socket.emit("init", { players: [...g.players.values()] });
      io.to(room).emit("players", [...g.players.values()]);
      io.to(room).emit("scores", Object.fromEntries(g.scores));
      syncRolesAndWord(room);
    },
    handleChat: (socket, msg) => {
      const room = Array.from(socket.rooms)[1];
      const g = games.get(room);
      if (!g || !msg) return;

      if (socket.id === g.realDrawerSocket) {
        return socket.emit("system", "🚫 Drawers cannot type in chat!");
      }

      const p = g.players.get(socket.id);
      if (msg.toLowerCase().trim() === g.word.toLowerCase()) {
        g.scores.set(socket.id, (g.scores.get(socket.id) || 0) + 50);
        discordInterface.send(g.channelId, `🎉 **${p.name}** guessed the word: **${g.word}**!`);
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
          const name = g.players.get(socket.id).name;
          g.players.delete(socket.id);
          discordInterface.send(g.channelId, `❌ **${name}** left the game.`);
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
