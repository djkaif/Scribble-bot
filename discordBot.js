import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes } from "discord.js";
import { REST } from "@discordjs/rest";
import { RULES } from "./game/constants.js";

export function startDiscordBot(gameManager, codeManager) {
  const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

  // ✅ Register Slash Command
  const commands = [
    new SlashCommandBuilder()
      .setName("start")
      .setDescription("Start a new Scribble game")
      .addUserOption(opt => opt.setName("drawer").setDescription("The person drawing (optional)"))
  ].map(cmd => cmd.toJSON());

  bot.once("ready", async () => {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
      console.log("Slash commands registered.");
    } catch (e) { console.error(e); }
  });

  bot.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "start") {
      const drawer = interaction.options.getUser("drawer");
      
      const game = gameManager.createGame({
        channelId: interaction.channelId,
        drawerId: drawer ? drawer.id : null
      });

      // ✅ Generate the join code for the user who ran the command
      const displayName = interaction.user.globalName || interaction.user.username;
      const res = codeManager.issueCode(interaction.user.id, game.id, displayName);

      const unix = Math.floor(res.expiresAt / 1000);

      const embed = new EmbedBuilder()
        .setTitle("🎨 Scribble Game Started")
        .setDescription(`Drawer: **${drawer ? drawer.tag : "Random"}**\nJoin using the code below!`)
        .setColor(0x5865f2);

      // ✅ Respond with Ephemeral message (Private)
      await interaction.reply({
        content: `🎟 **Your Private Join Link**\nCode: \`${res.code}\`\nExpires: <t:${unix}:R>\n${gameManager.baseUrl}/?room=${game.id}`,
        embeds: [embed],
        ephemeral: true
      });
    }
  });

  bot.login(process.env.TOKEN);
}
