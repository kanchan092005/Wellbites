const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const diseaseSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    goodIngredients: {
        type: String,
        required: true,
    },
});

const Disease = mongoose.model("Disease", diseaseSchema);
module.exports = Disease;
