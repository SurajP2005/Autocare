
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },

    documentType: {
        type: String,
        enum: [
            "Insurance",
            "Registration Certificate",
            "PUC",
            "Service Invoice",
            "Warranty",
            "Other"
        ],
        required: true
    },

    issueDate: {
        type: Date
    },

    expiryDate: {
        type: Date
    },

    fileUrl: {
        type: String
    },

    notes: {
        type: String
    },

    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        required: true
    }
});

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
