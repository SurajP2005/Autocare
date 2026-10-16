const mongoose=require("mongoose");

const maintenanceSchema=new mongoose.Schema({
    title:{
        type:String,
        required:true
    },
    description:{
        type:String
    },
    maintenanceType:{
        type:String,
        required:true
    },
    dueDate:{
        type:Date
    },
    dueOdometer:{
        type:Number
    },
    status:{
        type:String,
        enum:["Upcoming","Due Soon","Overdue","Completed"],
        default:"Upcoming"
    },
    vehicle:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Vehicle",
        required:true
    }
});

const Maintenance=mongoose.model("Maintenance",maintenanceSchema);

module.exports=Maintenance;

