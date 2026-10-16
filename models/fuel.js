
const mongoose = require("mongoose");

const fuelSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    odometer: {
        type: Number,
        required: true
    },
    litres: {
        type: Number,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    station: {
        type: String
    },
    fullTank: {
        type: Boolean,
        default: false
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        required: true
    }
});

const Fuel = mongoose.model("Fuel", fuelSchema);

module.exports = Fuel;
