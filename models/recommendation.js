const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const recommendationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    item: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        required: true,
    },
    recommendationType:{
        type: String,
    },
});

module.exports = mongoose.model('Recommendation', recommendationSchema);