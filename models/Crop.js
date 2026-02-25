const mongoose = require('mongoose');

const cropSchema = new mongoose.Schema({
    veg: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    plantedDate: {
        type: Date,
    },
    startDate: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active',
    }
}, { timestamps: true });

module.exports = mongoose.model('Crop', cropSchema);
