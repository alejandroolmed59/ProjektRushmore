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
async function getTftMatches(userName){
    try {
      const puuid = await getPuuid(userName);
      const response = await axios.get(`https://americas.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=10&api_key=${apiKey}`);
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
            return response.data.info.participants[i].placement;
        }
      }
    } catch (error) {
      console.error(error);
    }
}
async function Partidas(jugador){
    var contadorPosicion=0;
    var numPartidas=10;

    const arr = await  getTftMatches(jugador);
    for (var i = 0; i < 10; i++) {
        contadorPosicion += await getTftMatchPlacement(arr[0][i], arr[1]);
    }
    //console.log(contadorPosicion);
    return (contadorPosicion/numPartidas);
}

exports.Partidas = Partidas