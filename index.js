require('dotenv').config()

const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const lolApi = require('./lolDex')
const splash = require('./splashes')
const axios = require('axios');



client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  splash.Random().then(splash=>{
    client.user.setPresence({ activity: { name:  splash}, status: 'online' })
  });
})

client.on('guildMemberAdd', member => {
  // Send the message to a designated channel on a server:adsads
  const channel = member.guild.channels.find(ch => ch.name === 'general');
  // Do nothing if the channel wasn't found on this server
  if (!channel) return;
  // Send the message, mentioning the member
  channel.send(`Se unio un nuevo novio de la diega ${client.emojis.cache.find(emoji => emoji.name === "diega")}  ${member}`);
});

client.on('message', message => {
  // If the message is '!rip'
  var date = new Date();


  if(message.content.includes('!help')){
   message.reply('1. viernes: De ahorcar rucas. \n 2.!caracola: pregunta algo.  \n  3. SOS: pide ayuda.  \n  4. LIGOF: cringe moment.  \n  5. Amogus: ඞ \n 6. hola: hola. \n 7. yeah perdonden: perdonado. \n 8.PONGAN TUSA: opnen tusa \n 9. Dick: Antojas inmediatamente. \n 10. !splasheado: Pon un mensaje \n 11. !panamomento: besto momento \n 12. !Tiburon: la T en mayúsucula. \n 13. !QueTantoApesto: Promedio en tft. \n 14. !UltimoMatch: La ultima partida que jugaste de tft ' );
  }
	
  if (message.content.includes('viernes') && date.getDay() == 5) {
    message.reply('DE AHORCAR RUCAS MIJO!');
  }
	
if(message.content.includes('LIGOF')){
   message.reply('LEYENS');
   }
  if(message.content.toLowerCase()=="climaco"){
	const proba = Math.random();
    console.log(proba);
    if (proba <= 0.04) {
      message.channel.send(`¡DEJEN DORMIR! ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }
	 if(message.content.toLowerCase()=="AMOGUS"){
	
      message.reply(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣤⣤⣤⣤⣤⣶⣦⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⡿⠛⠉⠙⠛⠛⠛⠛⠻⢿⣿⣷⣤⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⠋⠀⠀⠀⠀⠀⠀⠀ ⢀⣀⣀⠈⢻⣿⣿⡄⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣸⣿⡏⠀⠀⠀⣠⣶⣾⣿⣿⣿⠿⠿⠿⢿⣿⣿⣿⣄⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣿⣿⠁⠀⠀⢰⣿⣿⣯⠁⠀⠀⠀⠀⠀⠀⠀⠈⠙⢿⣷⡄⠀
⠀⠀⣀⣤⣴⣶⣶⣿⡟⠀⠀⠀⢸⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣷⠀
⠀⢰⣿⡟⠋⠉⣹⣿⡇⠀⠀⠀⠘⣿⣿⣿⣿⣷⣦⣤⣤⣤⣶⣶⣶⣶⣿⣿⣿⠀
⠀⢸⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀
⠀⣸⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠉⠻⠿⣿⣿⣿⣿⡿⠿⠿⠛⢻⣿⡇⠀⠀
⠀⣿⣿⠁⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⢸⣿⣧⠀⠀
⠀⣿⣿⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⢸⣿⣿⠀⠀
⠀⣿⣿⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⢸⣿⣿⠀⠀
⠀⢿⣿⡆⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⠀⢸⣿⡇⠀⠀
⠀⠸⣿⣧⡀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⠀⣿⣿⠃⠀⠀
⠀⠀⠛⢿⣿⣿⣿⣿⣇⠀⠀⠀⠀⠀⣰⣿⣿⣷⣶⣶⣶⠀  ⢠⣿⣿⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⣿⣿⡇⠀⣽⣿⡏⠁⠀⠀ ⢸⣿⡇⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⣿⣿⡇⠀⢹⣿⡆⠀⠀⠀ ⣸⣿⠇⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢿⣿⣦⣄⣀⣠⣴⣿⣿⠁⠀⠈⠻⣿⣿⣿⣿⡿⠏⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠈⠛⠻⠿⠿⠿⠿⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`);
    
  }
	
  if (message.content === "prueba") {
    console.log('entro!');
    const streamOptions = { seek: 0, volume: 0.5 };
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
      `Le quedo mal ahí dogg ${client.emojis.cache.find(emoji => emoji.name === "badman")} `,
      "Si",
      `Si 0te ${client.emojis.cache.find(emoji => emoji.name === "emojiwithglasses")} `,
      `Jaja simon te me cuidas ${client.emojis.cache.find(emoji => emoji.name === "DabbingPengu")}`,
      'No',
      `Nelson Mandela ${client.emojis.cache.find(emoji => emoji.name === "doge")} `,
      `No sé pero estaría bueno que compraras Minoxidil ${client.emojis.cache.find(emoji => emoji.name === "chad")} `
    ];
    var item = respuestas[Math.floor(Math.random() * respuestas.length)];
    message.channel.send('La caracola magica dice: ' + item, {
      tts: false

    });
    if (item == "Si" || item == "No") {
      const random = Math.random();
      console.log(random);
      if (random < 0.30) {
        setTimeout(function () {
          message.channel.send(`KSUUKII DOGG ${client.emojis.cache.find(emoji => emoji.name === "emojiwithglasses")} `);
        }, 3000);

      }
    }
  }
  if (message.content.includes('!moneda')) {
    var respuestas = [
      'https://www.random.org/coins/faces/60-usd/0100c-jefferson/obverse.jpg',
      'https://www.random.org/coins/faces/60-usd/0100c-jefferson/reverse.jpg'
    ];
    const attachment = new Discord.MessageAttachment(respuestas[Math.floor(Math.random() * respuestas.length)]);
    message.channel.send(attachment);
  }
  if (message.content.toLowerCase().includes('nigga') || message.content.toLowerCase().includes('nigger') || message.content.toLowerCase().includes('niga')) {
    const attachment = new Discord.MessageAttachment('https://www.tntrafficticket.us/wp-content/uploads/2017/10/Police-officer-with-gun.jpg');
    message.channel.send(attachment);
    message.channel.send('STOP RIGHT THERE SHOW YOUR FUCKING N-WORD PASS NOW');
  }



if(message.content == 'SOS'){
   message.reply('SUS ඞ');
   }
	  
  if (message.content.toLowerCase() == 'hola') {
    const dogtor = client.emojis.cache.find(emoji => emoji.name === "diega");
    message.reply(`QUE DIIICE DOGGGTORR 🤙🏻🤙🏻 ${dogtor}`)
  }
  if (message.content.toLowerCase() == '!dios') {
    musica('https://www.youtube.com/watch?v=A_fCv76c4uQ', '476951287447945230');
    pics = [
      'https://i.imgur.com/ZXPa9YB.png',
      'https://cdn141.picsart.com/288827876023211.png',
      'https://ih1.redbubble.net/image.565335878.1839/aps,840x830,small,transparent-pad,1000x1000,f8f8f8.jpg',
      'https://media.tenor.com/images/75f3917dfc85e18961d96a7e19d111e8/tenor.gif',
      'https://www.kiddkeo.com/wp-content/uploads/2019/02/noticia_12.png'
    ]
    const attachment = new Discord.MessageAttachment(pics[Math.floor(Math.random() * pics.length)]);
    message.channel.send(attachment);
  }if(message.content.toLowerCase() == 'adios'){
    const attachment = new Discord.MessageAttachment('https://i.redd.it/jiviogg6o1551.jpg');
    message.channel.send(attachment);
  }

  if (message.content.toLowerCase().includes('yeah') || message.content.toLowerCase().includes('perdonen') && !message.author.bot) {
    musica('https://www.youtube.com/watch?v=wxk-jA5MsPM', '476951287447945230');

  }
  if (message.content.includes('PONGAN TUSA') && !message.author.bot) {
    musica('https://www.youtube.com/watch?v=Yf33M4KI1qI', '476951287447945230');
  }
  if (message.content.toLowerCase().includes('perdonado')) {
    client.channels.cache.get('476951287447945230').leave();
    message.channel.send(`${client.emojis.cache.find(emoji => emoji.name === "Dude")}`);
  }

  if (message.author.id == '232725409341505536') {
    const proba = Math.random();
    console.log(proba);
    if (proba <= 0.04) {
      message.channel.send(`Si torty, que jodes, está bien ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }
//<<<<<<< HEAD
  
//=======
if (message.author.id == '232725409341505536') {
    const proba = Math.random();
    console.log(proba);
    if (proba <= 0.04) {
      message.channel.send(`Si Justin, Warzone ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }
//>>>>>>> 8a46a0f749cd4f0ed144a43ea2b28742a6c3072b
  //if(message.content.toLowerCase().includes('!test')){
    //const canal = client.channels.cache.get("701160213130117199")
    //canal.send("!info")
  //}

  if(message.content.toLowerCase()=="dick"){
    const proba = Math.random();
    console.log(proba);
    if(proba<=0.15){
      message.channel.send(`Dick`);
    }if(proba<=0.05){
      message.channel.send(`Duck`);
    }if(proba<=0.04){
      message.channel.send(`No antojen :flushed: :pleading_face:`);
    }
  }

  if(message.content.toLowerCase().includes('!splasheado')){
    const newStr = message.content.split(' ').slice(1).join(' ');
    const author = message.author.username;
    const config = {
      headers: {
          'Content-Type': 'application/json'
      }
    }
    axios.post('http://ec2-35-168-1-45.compute-1.amazonaws.com:3000/splash/create', {
      msg:newStr,
      author:author
    }, config)
    .then(response=>{
      const estadoTemp = newStr
      client.user.setPresence({ activity: { name:  estadoTemp}, status: 'online' })
    })
    .catch(err=>console.log(err))
  }
  if(message.content.includes('!panamomento')){
    const arr = message.content.split(/ (.*)/);
    const repeat = arr[1];
    const pana = 'ese pana ';
    if(!isNaN(repeat) && repeat>0){
      message.reply(pana.repeat(repeat))
      mimir(message)
    }else{
      message.reply(`Escriba bien dagg :rage:`)
    }
  }
  if (message.content.includes('!QueTantoApesto')) {
    const arr = message.content.split(/ (.*)/);
    const player = arr[1];
    const numP = 7;
    lolApi.Partidas(player, numP).then(score => {
      if (score > 4) {
        message.channel.send(`@${message.author.username} Bro tu posicion promedio de tus ultimas ${numP} partidas es ${score}, la neta si apestas ${client.emojis.cache.find(emoji => emoji.name === "badman")}`)
      } else {
        message.channel.send(`@${message.author.username} Bro tu posicion promedio de tus ultimas ${numP} partidas es ${score}, keep up the good work ${client.emojis.cache.find(emoji => emoji.name === "Dude")}`)
      }

    }).catch(error=>{
      message.channel.send(`HEY CIPOTE <@260599195034058753> cambia la key ><`);
    });


  }
  if(message.content.includes('!Tiburon')){
    axios.get(`https://api.nomics.com/v1/currencies/ticker?key=${process.env.TIBURON}&ids=DOGE&interval=1d,30d&convert=USD&per-page=100&page=1`)
    .then(response=>{
	const attachment = new Discord.MessageAttachment('https://www.trecebits.com/wp-content/uploads/2021/04/Dogecoin-1.jpg');
      //const attachment = new Discord.MessageAttachment('https://www.freepngimg.com/thumb/bitcoin/73394-shiba-inu-doge-bitcoin-cryptocurrency-dogecoin.png');
      message.channel.send(attachment);
      message.channel.send(`$ ${response.data[0].price}`)
      if(response.data[0].price>1){
        message.channel.send('WE ARE RICH!')
      }
    })
    .catch(error=>{
      message.channel.send(`Se comió el top 8 con la dogecoin ${client.emojis.cache.find(emoji => emoji.name === "badman")}`)
    })
    
  }
  if (message.content.includes('!UltimoMatch')) {
    const arr = message.content.split(/ (.*)/);
    const player = arr[1];
    lolApi.LastMatch(player).then(json => {
      if (!json.pericosBool) {
        message.channel.send(`@${message.author.username} We que pisada ${client.emojis.cache.find(emoji => emoji.name === "badman")}
          Quedaste de ${json.puesto} lugar
          No llegaste a los pericos lul ${client.emojis.cache.find(emoji => emoji.name === "thonkms")}
          Marvin me dolio ${client.emojis.cache.find(emoji=>emoji.name==="marvin")}
          Te mamaste a ${json.eliminaciones} vatos, nice ${client.emojis.cache.find(emoji => emoji.name === "Dude")}
          Haciendoles ${json.damage} puntos de daño
          Sobreviviste el ${json.PorcentajePartida}% de la partida clacl.
        `)
      } else {
        message.channel.send(`@${message.author.username} Muy bien hijo sobreviviste a los pericos ${client.emojis.cache.find(emoji => emoji.name === "Dude")}
          Quedaste de ${json.puesto} lugar
          Te mamaste a ${json.eliminaciones} vatos, nice ${client.emojis.cache.find(emoji => emoji.name === "Dude")}
          Haciendoles ${json.damage} puntos de daño
          Sobreviviste el ${json.PorcentajePartida}% de la partida clacl.
        `)
      }
    }).catch(error=>{
      message.channel.send(error);
      console.log(error)
      message.channel.send(`HEY CIPOTE <@260599195034058753> cambia la key ><`);

    });
  }
});

async function mimir(message){
  var respuestas = [
    `Lo quiero mucho`,
    "Esta en el auto",
    `La extraña `,
    `Va a triunfar en la vida`,
    "Esta trabado",
	  "Esta comprando Shiba",
	  "Debería dejar de jugar al lol",
	  "Está en WarZZZone",
	  "Se comió el Top 8"
	
  ];
  var item = respuestas[Math.floor(Math.random() * respuestas.length)];
  await new Promise(r => setTimeout(r, 3000));
  message.reply(item);

}

var sensei = true;
setInterval(() => {
  var date = new Date();
  const channel = client.channels.cache.find(ch => ch.name === 'general');
  if (date.getHours() == 22 && date.getMinutes() == 20) {
    const emoji1 = client.emojis.cache.find(emoji => emoji.name === "diega")
    const emoji2 = client.emojis.cache.find(emoji => emoji.name === "emojiwithglasses")
    channel.send(`W`);

    if (sensei) {
      const streamOptions = { seek: 0, volume: 1 };
      var voiceChannel = client.channels.cache.get('476951287447945230');
      voiceChannel.join().then(connection => {
        console.log("joined channel");
        sensei = false;
        const stream = ytdl('https://www.youtube.com/watch?v=AiEIramZqZM', { filter: 'audioonly' });
        const dispatcher = connection.playStream(stream, streamOptions);
        dispatcher.on("end", end => {
          console.log("left channel");
          sensei = true;
          voiceChannel.leave();
        });
      }).catch(err => console.log(err));

    }
  }
}, 40000);

setInterval(() => {
  splash.Random().then(splash=>{
    console.log(splash)
    client.user.setPresence({ activity: { name:  splash}, status: 'online' })
  });
}, 600000);


function musica(url, voiceChannel) {
  const streamOptions = { seek: 0, volume: 0.5 };
  var voiceChannel = client.channels.cache.get(voiceChannel);
  voiceChannel.join().then(connection => {
    console.log("joined channel");
    const stream = ytdl(url, { filter: 'audioonly' });
    const dispatcher = connection.playStream(stream, streamOptions);
    //dispatcher.on("end", end => {
    // console.log("left channel");
    //voiceChannel.leave();
    //});
  }).catch(err => console.log(err));
}

function randomHour(startHour, endHour) {
  var date = new Date();
  var hour = startHour + Math.random() * (endHour - startHour) | 0;
  var minutes = date.getMinutes() + Math.random() * (59 - date.getMinutes());
  date.setHours(hour);
  date.setMinutes(minutes);
  return date;
}

client.login(process.env.TOKEN);


const express = require('express');
const app = express();
var port = process.env.PORT || 5005

app.get('/', (req, res) => {
  res.send('Estamos en vivo');
});

const server = app.listen(port, () => {
  console.log(`Express running → PORT ${server.address().port}`);
});