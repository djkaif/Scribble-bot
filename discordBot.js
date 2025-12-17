import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, MessageFlags } from "discord.js";
import { REST } from "@discordjs/rest";
import { RULES } from "./game/constants.js";

export function startDiscordBot(gameManager, codeManager) {
  const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

  // ✅ Register Slash Command
  const commands = [
    new SlashCommandBuilder()
      .setName("start")
      .setDescription("Create a new Scribble game")
      .addUserOption(opt => 
        opt.setName("drawer")
           .setDescription("Select who draws first (optional)")
      )
  ].map(cmd => cmd.toJSON());

  bot.once("ready", async () => {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
      console.log("✅ Slash commands registered");
    } catch (e) { 
      console.error("Error registering commands:", e); 
    }
  });

  bot.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "start") {
      const drawer = interaction.options.getUser("drawer");
      
      // Create the game instance in gameManager
      const game = gameManager.createGame({
        channelId: interaction.channelId,
        drawerId: drawer ? drawer.id : null
      });

      // Get requester's display name to store in the codeManager
      const displayName = interaction.user.globalName || interaction.user.username;
      
      // Issue the code and link it to the Discord Display Name
      const res = codeManager.issueCode(interaction.user.id, game.id, displayName);

      if (!res.ok) {
        return interaction.reply({ 
          content: res.reason, 
          flags: [MessageFlags.Ephemeral] 
        });
      }

      const unix = Math.floor(res.expiresAt / 1000);

      const embed = new EmbedBuilder()
        .setTitle("🎨 Scribble Room Created")
        .setDescription(
          `Channel: <#${interaction.channelId}>\n` +
          `Drawer: **${drawer ? drawer.username : "Random"}**\n\n` +
          `Click the link and enter your code on the website.`
        )
        .setColor(0x5865f2);

      // ✅ FIXED: Using MessageFlags.Ephemeral instead of ephemeral: true
      await interaction.reply({
        content: `🎟 **PRIVATE ACCESS**\n` +
                 `Code: \`${res.code}\`\n` +
                 `Expires: <t:${unix}:R>\n` +
                 `Link: ${gameManager.baseUrl}/?room=${game.id}`,
        embeds: [embed],
        flags: [MessageFlags.Ephemeral]
      });
    }
  });

  bot.login(process.env.TOKEN);
}
