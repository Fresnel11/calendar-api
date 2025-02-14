const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    allDay: { type: Boolean, default: false },
    recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], default: 'none' },
    location: { type: String, default: '' },
    description: { type: String, default: '' }
}, { timestamps: true });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
