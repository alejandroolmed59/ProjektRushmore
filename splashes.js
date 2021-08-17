const axios = require('axios')
const shuffle = require('shuffle-array')

async function fixArr (array){
    const arrayFixed =shuffle(array).map(splash=>{
        return splash.msg
   })
   return arrayFixed
}

async function Random(){
        const arr = await axios.get('http://localhost:3000/splash')
        const random = await fixArr(arr.data)
        console.log(random);
        return random[0]
}

exports.Random = Random