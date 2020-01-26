const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.TFTKEY

async function getPuuid(userName) {
    try {
      const response = await axios.get(`https://la1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${userName}?api_key=${apiKey}`);
      return response.data.puuid;
    } catch (error) {
      console.error(error);
    }
}
async function getTftMatches(userName, numPartidas){
    try {
      const puuid = await getPuuid(userName);
      const response = await axios.get(`https://americas.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${numPartidas}&api_key=${apiKey}`);
      return [response.data, puuid];
    } catch (error) {
      console.error(error);
    }
}

async function getTftMatchPlacement(idMatch, puuid){
    try {
      const response = await axios.get(`https://americas.api.riotgames.com/tft/match/v1/matches/${idMatch}?api_key=${apiKey}`);
      //console.log(response.data.info.participants);
      for(var i =0; i<8; i++){
        if(response.data.info.participants[i].puuid == puuid){
            return {partidaJugador: response.data.info.participants[i],
                    tiempoPartida: response.data.info.game_length
            }
            ;
        }
      }
    } catch (error) {
      console.error(error);
    }
}
async function Partidas(jugador, numPartidas){
    var contadorPosicion=0;
    const arr = await  getTftMatches(jugador, numPartidas);
    for (var i = 0; i < numPartidas; i++) {
        await getTftMatchPlacement(arr[0][i], arr[1]).then(match=>{
          contadorPosicion += match.partidaJugador.placement;
        });
    }
    return (contadorPosicion/numPartidas);
}

async function LastMatch(jugador){
  
  const arr = await  getTftMatches(jugador, 1);
  var match = await getTftMatchPlacement(arr[0][0], arr[1]);
  const tiempoPartida = match.tiempoPartida
  match = match.partidaJugador;
  var pericos = match.last_round>25? true: false;
  return {
    tiempoPartida: Math.floor(tiempoPartida/60),
    puesto: match.placement,
    pericosBool: pericos,
    tiempo: Math.floor(match.time_eliminated/60),
    eliminaciones: match.players_eliminated,
    damage: match.total_damage_to_players,
    PorcentajePartida: Math.ceil((match.time_eliminated/tiempoPartida)*100)
  }
}

exports.Partidas = Partidas
exports.LastMatch = LastMatch