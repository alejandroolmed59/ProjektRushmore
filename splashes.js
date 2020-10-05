const axios = require('axios')
const shuffle = require('shuffle-array')

async function fixArr (array){
    const arrayFixed =shuffle(array).map(splash=>{
       if(splash.author!==undefined && splash.author!==''){
           return splash.msg+' -'+splash.author
       }else{
           return splash.msg
       }
   })
   return arrayFixed
}

async function Random(){
        const arr = await axios.get('https://controlasistenciacooler.herokuapp.com/splash/')
        const random = await fixArr(arr.data)
        return random[0]
}

exports.Random = Random