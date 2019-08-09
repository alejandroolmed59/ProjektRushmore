require('dotenv').config()

const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', message => {
  // If the message is '!rip'
  if (message.content === 'viernes') {
    message.reply('De AHORCAR RUCAS MIJO!');
  }
  if (message.content === "prueba") {
    console.log('entro!');
    const streamOptions = { seek: 0, volume: 1 };
    var voiceChannel = message.member.voiceChannel;
    voiceChannel.join().then(connection => {
      console.log("joined channel");
      const stream = ytdl('https://www.youtube.com/watch?v=AiEIramZqZM', { filter: 'audioonly' });
      const dispatcher = connection.playStream(stream, streamOptions);
      dispatcher.on("end", end => {
        console.log("left channel");
        voiceChannel.leave();
      });
    }).catch(err => console.log(err));
  }
});

client.on('message', message => {
  // If the message is '!rip'
  if (message.content.includes('!caracola')) {
    var respuestas = [
      "Si",
      "No",
      "Talvez",
      "Tu gfa x si acaso"
    ];
    var item = respuestas[Math.floor(Math.random() * respuestas.length)];
    message.reply('La caracola magica dici: ' + item);
  }
  if (message.content == 'hola') {
    const dogtor = client.emojis.find(emoji => emoji.name === "diega");
    message.reply(`QUE DIIICE DOGGGTORR 🤙🏻🤙🏻`)
  }
  if (message.content.toLowerCase() == '!dios') {
    musica('https://www.youtube.com/watch?v=A_fCv76c4uQ', '476951287447945230');
    const attachment = new Attachment('https://www.bilbaoplan.com/wp-content/uploads/2017/06/kidd-keo-santana-junio-bilbao.jpg');
    message.channel.send(attachment);
  }
});


var sensei=true;
setInterval(() => {
  var date = new Date();
  const channel = client.channels.find(ch => ch.name === 'general');
  if (date.getHours() == 16 && date.getMinutes() == 20) {
    const emoji1 = client.emojis.find(emoji => emoji.name === "diega")
    const emoji2 = client.emojis.find(emoji => emoji.name === "emojiwithglasses")
    channel.send(`${emoji2} @everyone ¡ASHASDHASDHADHASDHHFHSDF 420 GSDGSGS 420! ${emoji1} ${emoji2}`);

    if(sensei){
    const streamOptions = { seek: 0, volume: 1 };
    var voiceChannel = client.channels.get('476951287447945230');
    voiceChannel.join().then(connection => {
      console.log("joined channel");
      sensei=false;
      const stream = ytdl('https://www.youtube.com/watch?v=AiEIramZqZM', { filter: 'audioonly' });
      const dispatcher = connection.playStream(stream, streamOptions);
      dispatcher.on("end", end => {
        console.log("left channel");
        sensei=true;
        voiceChannel.leave();
      });
    }).catch(err => console.log(err));

  }  
  }
}, 5000);

function musica(url, voiceChannel){
  console.log('entro!');
    const streamOptions = { seek: 0, volume: 1 };
    var voiceChannel = client.channels.get('476951287447945230');
    voiceChannel.join().then(connection => {
      console.log("joined channel");
      const stream = ytdl(url , { filter: 'audioonly' });
      const dispatcher = connection.playStream(stream, streamOptions);
      dispatcher.on("end", end => {
        console.log("left channel");
        voiceChannel.leave();
      });
    }).catch(err => console.log(err));
}

client.login(process.env.TOKEN);
