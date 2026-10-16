const { default: mongoose } = require("mongoose");
const mongooose=require("mongoose");

const expenseSchema=new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        required: true
    }
});

const Expense=mongoose.model("Expense",expenseSchema);
module.exports=Expense;