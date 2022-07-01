require('dotenv').config()

const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const lolApi = require('./lolDex')
const splash = require('./splashes')
const axios = require('axios');



client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  splash.Random().then(splash => {
    client.user.setPresence({ activity: { name: splash }, status: 'online' })
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

//RESPUESTAS Y FUNCIONES DE RUSHMORE
client.on('message', message => {
  // If the message is '!rip'
  var date = new Date();

  //HELP
  if (message.content.includes('!help')) {
    message.reply('¡HOLA, gracias por solicitar la ayuda de Rushmore! \n Vaya mirá, usá ! antes de cada frase para hacerme funcionar. Por favor respeta las mayúsculas, gracias.\n \n 1. help: Muestra una lista con todos los comandos de ProjektRushmore. \n 2. viernes: De ahorcar rucas (_Disponible solo los viernes_). \n 3. ligof: Leyens. \n 4. amogus: Pasarán cosas sospechosas. \n 5. caracola: Pregúntale cosas a la caracola. \n 6. moneda: Muestra una moneda... y ya... \n 7. sos: ඞ \n 8. dios: dracukeo. \n 9. hola: Te saludo. (no requiere !)\n 10. adios: Me despido. (no requiere !)\n 11. dick: :flushed: \n 12. splasheado: Mensaje de estado. \n 13. panamomento: Besto momento. \n 14. QueTantoApesto: Promedio de tus últimas 7 partidas de TFT. \n 15. UltimoMatch: Resultados de tu última partida. \n 16. Tiburón: Precio actual del Doge. \n 17. perdonado: Meper d0nas. \n 18. GVGMALL: Publicidad. \n 19. lectura: ¿Todavía no lo han leído? \n 20. Surfshark: VPN. \n 21. Albion: Un MMORPG no lineal. \n 22. CuantoOdio: Muestra cuánto odias a las embraz.\n **POR FAVOR NO DECIR LA N-PALABRA. SE PEDIRÁ UN PASE**');
  }

  //viernes
  if (message.content.includes('viernes') && date.getDay() == 5) {
    message.reply('DE AHORCAR RUCAS MIJO!');
  }

  //ligof
  if (message.content.toLowerCase() == '!LIGOF') {
    message.reply('LEYENS');
  }

  //cuando se hable de climaco
  if (message.content.toLowerCase() == 'climaco') {
    const probaLigof = Math.random();
    console.log(probaLigof);
    if (probaLigof <= 0.02) {
      message.channel.send(`¡DEJEN DORMIR! ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  //amogus
  if (message.content.toLowerCase() == '!AMOGUS') {

    message.reply('ඞ https://www.youtube.com/watch?v=grd-K33tOSM ඞ');

  }

  //algo de prueba D
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

//lo de la caracola
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
      `No sé pero estaría bueno que compraras Minoxidil ${client.emojis.cache.find(emoji => emoji.name === "chad")} `,
      `Qué se yo master ${client.emojis.cache.find(emoji => emoji.name === "patsleep")} `,
      `En efecto ${client.emojis.cache.find(emoji => emoji.name === "GIGAchad")} `,
      `${client.emojis.cache.find(emoji => emoji.name === "callate_pue")} `,
      `No debiste preguntar eso ${client.emojis.cache.find(emoji => emoji.name === "delete_this")} `,
      `Así es mi estimado amigo traga-pitos ${client.emojis.cache.find(emoji => emoji.name === "peepo_heart")} `,
      `Google.com `,
      `Eso está algo sus master ${client.emojis.cache.find(emoji => emoji.name === "sus")} `
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

  //muestra un dólar
  if (message.content.includes('!moneda')) {
    var respuestas = [
      'https://www.random.org/coins/faces/60-usd/0100c-jefferson/obverse.jpg',
      'https://www.random.org/coins/faces/60-usd/0100c-jefferson/reverse.jpg'
    ];
    const attachment = new Discord.MessageAttachment(respuestas[Math.floor(Math.random() * respuestas.length)]);
    message.channel.send(attachment);
  }

  //pide el n-pass
  if (message.content.toLowerCase().includes('nigga') || message.content.toLowerCase().includes('nigger') || message.content.toLowerCase().includes('niga') || message.content.toLowerCase().includes('negro')) {
    const attachment = new Discord.MessageAttachment('https://www.tntrafficticket.us/wp-content/uploads/2017/10/Police-officer-with-gun.jpg');
    message.channel.send(attachment);
    message.channel.send('STOP RIGHT THERE SHOW YOUR FUCKING N-WORD PASS NOW');
  }

  //pedir ayuda
  if (message.content.toLowerCase() == '!SOS') {
    message.reply('SUS ඞ');
  }

  //saluda
  if (message.content.toLowerCase() == 'hola') {
    const dogtor = client.emojis.cache.find(emoji => emoji.name === "diega");
    message.reply(`QUE DIIICE DOGGGTORR 🤙🏻🤙🏻 ${dogtor}`)
  }

  //drakukeo
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
  }

  //se despide
  if (message.content.toLowerCase() == 'adios' || message.content.toLowerCase() == 'adiós') {
    const attachment = new Discord.MessageAttachment('https://i.redd.it/jiviogg6o1551.jpg');
    message.channel.send(attachment);
  }

  //yeah perdonen, tusa y perdonado

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

  //Respuestas con :f_:
  if (message.author.id == '232725409341505536') {
    const proba = Math.random();
    console.log(proba);
    if (proba == 0.01) {
      message.channel.send(`Si torty, que jodes, está bien ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  if (message.author.id == '232725409341505536') {
    const proba = Math.random();
    console.log(proba);
    if (proba == 0.01) {
      message.channel.send(`Si Justin, Warzone ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  if (message.author.id == '329013675132452864') {
    const proba = Math.random();
    console.log(proba);
    if (proba == 0.01) {
      message.channel.send(`Si Zork, andá a jugar lol ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  if (message.author.id == '311297360615440404') {
    const proba = Math.random();
    console.log(proba);
    if (proba == 0.01) {
      message.channel.send(`Si Ra, ya sabemos que odias a las embraz ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  if (message.author.id == '260599195034058753') {
    const proba = Math.random();
    console.log("ono" + proba);
    if (proba == 0.01) {
      message.channel.send(`Lo que digas Olmedo ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  if (message.author.id == '221099047161692163') {
    const proba = Math.random();
    console.log(proba);
    if (proba == 0.01) {
      message.channel.send(`Ok Alexis ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }

  //proba de que rushmore diga dick
  if (message.content.toLowerCase() == "dick") {
    const proba = Math.random();
    console.log(proba);
    if (proba == 0.15) {
      message.channel.send(`Dick`);
    } if (proba == 0.05) {
      message.channel.send(`Duck`);
    } if (proba == 0.04) {
      message.channel.send(`No antojen :flushed: :pleading_face:`);
    }
  }

  //splasheado
  if (message.content.toLowerCase().includes('!splasheado')) {
    const newStr = message.content.split(' ').slice(1).join(' ');
    const author = message.author.username;
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    }
    axios.post('http://ec2-35-168-1-45.compute-1.amazonaws.com:3000/splash/create', {
      msg: newStr,
      author: author
    }, config)
      .then(response => {
        const estadoTemp = newStr
        client.user.setPresence({ activity: { name: estadoTemp }, status: 'online' })
      })
      .catch(err => console.log(err))
  }

  //panamomento
  if (message.content.includes('!panamomento')) {
    const arr = message.content.split(/ (.*)/);
    const repeat = arr[1];
    const pana = 'ese pana ';
    if (!isNaN(repeat) && repeat > 0) {
      message.reply(pana.repeat(repeat))
      mimir(message)
    } else {
      message.reply(`Escriba bien dagg :rage:`)
    }
  }

  //promedio tft
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

    }).catch(error => {
      message.channel.send(`HEY CIPOTE <@260599195034058753> cambia la key ><`);
    });


  }

  //precio del doge
  if (message.content.includes('!Tiburon')) {
    axios.get(`https://api.nomics.com/v1/currencies/ticker?key=${process.env.TIBURON}&ids=DOGE&interval=1d,30d&convert=USD&per-page=100&page=1`)
      .then(response => {
        const attachment = new Discord.MessageAttachment('https://www.trecebits.com/wp-content/uploads/2021/04/Dogecoin-1.jpg');
        //const attachment = new Discord.MessageAttachment('https://www.freepngimg.com/thumb/bitcoin/73394-shiba-inu-doge-bitcoin-cryptocurrency-dogecoin.png');
        message.channel.send(attachment);
        message.channel.send(`$ ${response.data[0].price}`)
        if (response.data[0].price > 1) {
          message.channel.send('WE ARE RICH!')
        }
      })
      .catch(error => {
        message.channel.send(`Se comió el top 8 con la dogecoin ${client.emojis.cache.find(emoji => emoji.name === "badman")}`)
      })

  }

  //GVGMALL
  if (message.content == '!GVGVMALL') {
    message.channel.send('Este video está patrocinado por GVG Mall. GVG Mall es una tienda online de claves de software, donde puedes encontrar claves para Windows 10 profesional, como la que estoy comprando ahora mismo para mi pc. Las claves son mucho más económicas que las que vende Microsoft (de hecho esta cuesta tan solo quince dólares) porque son de un tipo muy especial llamado OEM. GVG Mall está autorizado para venderlas y son claves legales, la única pega que tienen es que se van a ligar al hardware que tienes en tu pc instalado ahora mismo, por lo que si algún día cambias algún componente posiblemente tengas que volver a activar Windows... pero por el precio, comparado por una clave completa, creo que vale muchísimo la pena. Se pueden pagar por PayPal y no tenéis que esperar horas o días como pasa en otras tiendas online. Os dejo enlaces a la tienda en la descripción y también un código de descuento de un 15%. Ahora sigamos con el video de hoy.');
  }

  //Morterito
  if (message.content == '!lectura') {
    message.channel.send('¡Joder! ¿Todavía no han leído eso? Y entonces ¿en qué carajo estamos pues? Miren bichos, yo no les voy a ayudar en nada. Les voy a dejar la nota del parcial así, con ese 6. Y me voy a poner yuca con los trabajos de los esquemas y más con el ensayo. Tal vez así avivan y se ponen las pilas de una puta vez. Estuvieron va de joder de que les mandara el ejemplo; les mando los dos putos ejemplos ¡y no los han leído! ¡Es una puta vergüenza con ustedes! Y algunos ya son de cuarto y de quinto año ¿qué mierda van a ir a hacer a un trabajo? No me jodan. ¿Qué mierda van a ir a hacer a un trabajo? Les debería de dar vergüenza. Puta, un maldito examen de mierda no pueden sacar una nota decente estando en la puta casa con toda la computadora, el internet, los apuntes y con las clases grabadas... ¡No me jodan! ¡No me jodan! Puta, ya hubiéramos querido nosotros en nuestra época que nos lo dieran todo en la trompa... puta a ustedes lo tienen todo, tienen computadoras, tienen tecnología, muchos de ustedes no hacen ni mierda, sus papás son los que les pagan las cosas ¡y siguen de huevones y no quieren hacer las cosas! ¡No hacen las mierdas! Bichos, no jodan hombre. Puta, no sean sin vergüenzas. Mejor díganle a su papá o a su mamá: "Mira no me pagues la universidad, me voy a ir a vender tomates al mercado". No quiero, no quiero volver a hacer una pregunta y que pasen más de dos segundos callados sin que me contesten. Ayer me dijeron: "¡Ay! Es que mucho material". ¡Déjense de mariconadas! ¡Déjense de mariconadas! ¡Déjense de mierdas! Hoy se van a enterar lo que es tener mucho material. De aquí en adelante se van a enterar lo que es tener mucho material para leer. Joder con ustedes mano, joder... madre...')
  }

  //Surfshark
  if (message.content == '!Surfshark') {
    message.channel.send('Surfshark es un servicio de VPN. En otras palabras te permite conectarte a internet a través de sus servidores, de esa manera puedes cambiar tu ip y engañar a distintos servicios que sólo estan disponibles en ciertos países, como por ejemplo Hulu, o incluso ver contenido que está restringido como ciertas películas o series de Netflix. Además una vez lo tienes activado se encarga de filtrar por ti anuncios maliciosos y malware, y sobre todo si te conectas desde redes públicas o incluso si un vecino te está robando tu Wi-Fi no podrá espiarte porque la conexión está encriptada con un algoritmo de cifrado AES-256. Utiliza el código de descuento "Nate" para obtener un 85% de descuento y 3 meses gratis. Te dejo abajo el link en la descripción. Gracias a Surfshark por patrocinar este video. Y ahora sigamos con el contenido de hoy 3 meses gratis')
  }

  //Albion
  if (message.content == '!Albion') {
    message.channel.send('Albion online es un mmorpg no lineal en el que escribes tu propia historia sin limitarte a seguir un camino prefijado, explora un amplio mundo abierto con cinco biomas unicos, todo cuanto hagas tendra su repercusíon en el mundo, con su economia orientada al jugador de albion los jugadores crean practicamente todo el equipo a partir de los recursos que consiguen, el equipo que llevas define quien eres, cambia de arma y armadura para pasar de caballero a mago o juego como una mezcla de ambas clases, aventurate en el mundo abierto y haz frente a los habitantes y las criaturas de albion, inicia expediciones o adentrate en mazmorras en las que encontraras enemigos aun mas dificiles, enfrentate a otros jugadores en encuentros en el mundo abierto, lucha por los territorios o por ciudades enteras en batallas tacticas, relajate en tu isla privada donde podras construir un hogar, cultivar cosechas, criar animales, unete a un gremio, todo es mejor cuando se trabaja en grupo [musica] adentrate ya en el mundo de albion y escribe tu propia historia.')
  }

  //Odias a las embraz
  if (message.content == '!CuantoOdio') {
    function getRandomArbitrary(min, max) {
      return Math.random() * (max - min) + min;
    }
    const numeroal = getRandomArbitrary(0, 100);

    message.channel.send(`le tienes un ${parseInt(numeroal)}% de odio a las embraz`)
  }

  //ultimo match tft
  if (message.content.includes('!UltimoMatch')) {
    const arr = message.content.split(/ (.*)/);
    const player = arr[1];
    lolApi.LastMatch(player).then(json => {
      if (!json.pericosBool) {
        message.channel.send(`@${message.author.username} We que pisada ${client.emojis.cache.find(emoji => emoji.name === "badman")}
          Quedaste de ${json.puesto} lugar
          No llegaste a los pericos lul ${client.emojis.cache.find(emoji => emoji.name === "thonkms")}
          Marvin me dolió ${client.emojis.cache.find(emoji => emoji.name === "marvin")}
          Pero al menos te mamaste a ${json.eliminaciones} vatos ${client.emojis.cache.find(emoji => emoji.name === "Dude")}
          Y les hiciste ${json.damage} puntos de daño
          Sobreviviste el ${json.PorcentajePartida}% de la partida clacl.
        `)
      } else {
        message.channel.send(`@${message.author.username} Muy bien hijo sobreviviste a los pericos ${client.emojis.cache.find(emoji => emoji.name === "Dude")}
          Quedaste de ${json.puesto} lugar
          Te mamaste a ${json.eliminaciones} vatos, nice ${client.emojis.cache.find(emoji => emoji.name === "Dude")}
          Haciéndoles ${json.damage} puntos de daño
          Sobreviviste el ${json.PorcentajePartida}% de la partida clacl.
        `)
      }
    }).catch(error => {
      message.channel.send(error);
      console.log(error)
      message.channel.send(`HEY CIPOTE <@260599195034058753> cambia la key >< ¿O querés una pechada?`);

    });
  }
});

/*
  if (message.author.id == '232725409341505536') {
    const proba = Math.random();
    console.log(proba);
    if (proba <= 0.04) {
      message.channel.send(`Si torty, que jodes, está bien ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }*/
//<<<<<<< HEAD

//=======
/*
if (message.author.id == '268955815719862272') {
if (message.author.id == '232725409341505536') {
    const proba = Math.random();
    console.log(proba);
    if (proba <= 0.04) {
      message.channel.send(`Si Justin, Warzone ${client.emojis.cache.find(emoji => emoji.name === "f_")}`);
    }
  }*/
//>>>>>>> 8a46a0f749cd4f0ed144a43ea2b28742a6c3072b
//if(message.content.toLowerCase().includes('!test')){
//const canal = client.channels.cache.get("701160213130117199")
//canal.send("!info")
//}

async function mimir(message) {
  var respuestas = [
    `Lo quiero mucho`,
    `Esta en el auto`,
    `La extraña `,
    `Va a triunfar en la vida`,
    `Esta trabado`,
    `Esta comprando Shiba`,
    `Debería dejar de jugar al lol`,
    `Está en WarZZZone`,
    `Se comió el Top 8`,
    `Compró SHIB en el ATH :joy:`,
    `Compró en el dipeo ${client.emojis.cache.find(emoji => emoji.name === "emojiwithglasses")}`,
    `Debería dejar de procastinar`

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
  splash.Random().then(splash => {
    console.log(splash)
    client.user.setPresence({ activity: { name: splash }, status: 'online' })
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