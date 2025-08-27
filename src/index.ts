import {
  Client,
  GatewayIntentBits,
  Message,
  MessageReaction,
  EmbedBuilder,
} from "discord.js";
import dotenv from "dotenv";
dotenv.config();

interface Gambler {
  name: string;
  value: string;
}

const gamblers: Gambler[] = [
  {
    name: "olme59",
    value: "500",
  },
  {
    name: "zork",
    value: "500",
  },
];

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
  if (message.content === "!money") {
    const embed = new EmbedBuilder()
      .setTitle("Dineros")
      .setDescription("Balance de teclennios")
      .addFields([...gamblers])
      .setColor(0x5865f2);

    message.reply({ embeds: [embed] });
  }
  if (message.content === "!faucet") {
    const gamblerExisting = gamblers.find((gambler) => {
      return gambler.name === message.author.id;
    });
    if (!gamblerExisting) {
      gamblers.push({ name: message.author.id, value: "500" });
      message.reply("Nuevo gambler creado!");
    } else {
      message.reply("gambler ya tiene mony");
    }
  }
});

client.login(process.env.TOKEN);
