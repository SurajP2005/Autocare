const mongoose=require("mongoose");

const serviceSchema=new mongoose.Schema({
    date:{
        type:Date,
        required:true
    },
    odometer:{
        type:Number,
        required:true
    },
    serviceType:{
        type:String,
        required:true
    },
    garage:{
        type:String,
        required:true
    },
    cost:{
        type:Number,
        required:true
    },
    notes:{
        type:String
    },
    invoice:{
        type:String
    },
    parts:{
        type:String
    },
    vehicle:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Vehicle",
        required:true
    }
});

const Service=mongoose.model("Service",serviceSchema);

module.exports=Service;