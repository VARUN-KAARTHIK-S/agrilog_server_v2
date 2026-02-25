const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    veg: {
        type: String,
        required: true,
    },
    cropId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Crop',
        required: true,
    },
    date: {
        type: Date,
        required: true
    },
    boxes: {
        type: Number,
        required: true,
        default: 0
    },
    rate: {
        type: Number,
        default: 0
    },
    commission: {
        type: Number,
        required: true,
        default: 0
    },
    billReceived: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Record', recordSchema);
