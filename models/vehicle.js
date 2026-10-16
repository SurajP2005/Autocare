const mongoose=require("mongoose");

const vehicleSchema=new mongoose.Schema({
    brand:{
        type:String,
        required:true
    },
    model:{
        type:String,
        required:true
    },
    variant:{
        type:String,

    },
    year:{
        type:Number,
        required:true
    },
    fuelType:{
        type:String,
        required:true
    },
    transmission:{
        type:String,
        required:true
    },
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    registrationNumber:{
        type: String,
        required: true
    },
    currentOdometer: {
    type: Number,
    required: true
    },
    purchaseDate: {
        type: Date
    },
    image: {
        type: String
    }
});

const Vehicle=mongoose.model("Vehicle",vehicleSchema);
module.exports=Vehicle;