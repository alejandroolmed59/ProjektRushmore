require('dotenv').config()

const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('pong');
  }
});

client.login('NjA5NDM0MjM5MzMwNDE4NzA5.XU2qUQ.maHRXlhYH1OuIzECmKwteTg3NU0');
