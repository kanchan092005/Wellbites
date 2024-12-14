const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cartSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    type: Schema.Types.ObjectId,
    ref: 'CartItem'
  }],
  totalPrice: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Cart', cartSchema);
