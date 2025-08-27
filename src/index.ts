import { Client, GatewayIntentBits, Message } from "discord.js";
import dotenv from "dotenv";
dotenv.config();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
});

client.on("messageCreate", (message: Message) => {
  if (message.author.bot) return; // ignore bots

  if (message.content === "hola") {
    message.reply("calla puta");
  }

  if (message.content === "!ping") {
    message.reply("Pong!");
  }
});

client.login(process.env.TOKEN);
