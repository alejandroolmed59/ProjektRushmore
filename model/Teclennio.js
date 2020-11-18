var mongoose= require('mongoose');
var Schema = mongoose.Schema;


const TeclenniosSchema= new Schema({
    discId:{
        type:String,
        required:true
    },
    nombre:{
        type:String,
        required:true
    },
    heteroPoints:{
        type:Number,
        required:true
    }
})

module.exports= mongoose.model('teclennios',TeclenniosSchema);