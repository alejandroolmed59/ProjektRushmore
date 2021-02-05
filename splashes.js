const axios = require('axios')
const shuffle = require('shuffle-array')

async function fixArr (array){
    const arrayFixed =shuffle(array).map(splash=>{
        return splash.msg
   })
   return arrayFixed
}

async function Random(){
        const arr = await axios.get('http://ec2-35-168-1-45.compute-1.amazonaws.com:3000/splash')
        const random = await fixArr(arr.data)
        return random[0]
}

exports.Random = Random