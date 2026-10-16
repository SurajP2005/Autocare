const mongoose=require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;


const userSchema=new mongoose.Schema({
    username:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },

});
userSchema.plugin(passportLocalMongoose);

const User=mongoose.model("User",userSchema);

module.exports=User;