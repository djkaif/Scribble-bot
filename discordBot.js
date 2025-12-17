import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes } from "discord.js";
import { REST } from "@discordjs/rest";

// ✅ Interface to allow gameManager to talk to Discord
export const discordInterface = {
  send: () => {} 
};

export function startDiscordBot(gameManager, codeManager) {
  const bot = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.GuildMessageReactions 
    ] 
  });

  const commands = [
    new SlashCommandBuilder()
      .setName("start")
      .setDescription("Start a Scribble game")
      .addUserOption(opt => opt.setName("drawer").setDescription("The first drawer")),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("View the current scores for the game in this channel")
  ].map(cmd => cmd.toJSON());

  bot.once("clientReady", async () => {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
      console.log("✅ Commands registered");
    } catch (e) { console.error(e); }

    // ✅ Link the game notifications to the real bot
    discordInterface.send = async (channelId, text) => {
      try {
        const channel = await bot.channels.fetch(channelId);
        if (channel) channel.send(text);
      } catch (e) {}
    };
  });

  bot.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "start") {
      await interaction.deferReply();
      const drawer = interaction.options.getUser("drawer");
      const game = gameManager.createGame({
        channelId: interaction.channelId,
        drawerId: drawer ? drawer.id : null
      });

      const embed = new EmbedBuilder()
        .setTitle("🎨 Scribble Room Ready!")
        .setDescription(`**Host:** ${interaction.user.username}\n**Drawer:** ${drawer ? drawer.username : "Random"}\n\n1️⃣ **[Click Here to Open Game](${gameManager.baseUrl}/?room=${game.id})**\n2️⃣ React with ✏️ to get your code.`)
        .setColor(0x5865f2);

      const message = await interaction.editReply({ embeds: [embed], fetchReply: true });
      await message.react("✏️");

      const collector = message.createReactionCollector({ filter: (r, u) => r.emoji.name === "✏️" && !u.bot, time: 600000 });
      collector.on("collect", async (reaction, user) => {
        const res = codeManager.issueCode(user.id, game.id, user.globalName || user.username);
        if (!res.ok) return user.send(`❌ ${res.reason}`).catch(() => null);
        user.send(`🎟 **Join Code:** \`${res.code}\``).catch(() => {
          interaction.channel.send(`⚠️ <@${user.id}>, open your DMs for the code!`).then(m => setTimeout(() => m.delete(), 5000));
        });
      });
    }

    if (interaction.commandName === "leaderboard") {
      const scores = gameManager.getScoresByChannel(interaction.channelId);
      const embed = new EmbedBuilder()
        .setTitle("🏆 Current Scores")
        .setDescription(scores || "No active game in this channel.")
        .setColor(0x57f287);
      await interaction.reply({ embeds: [embed] });
    }
  });

  bot.login(process.env.TOKEN);
}
