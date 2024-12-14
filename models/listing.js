const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    image: {
        filename: { type: String, default: "listingimage" },
        url: {
            type: String,
            default: "https://images.pexels.com/photos/1640770/pexels-photo-1640770.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
        },
    },
    price: Number,
    calorie: Number,
    fat: Number,
    protein: Number,
    ingredients: {
        type: [String],
        required: true,
    },
    tasteProfile: {  // New attribute for taste profile
        type: String,
        required: true,
    }

});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
