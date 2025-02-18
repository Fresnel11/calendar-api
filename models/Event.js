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
    description: { type: String, default: '' },
    reminder: { 
        type: String, 
        enum: [
            'none', 'at_event_time', '5_min_before', '15_min_before', 
            '30_min_before', '1_hour_before', '2_hours_before', 
            '12_hours_before', '1_day_before', '1_week_before'
        ], 
        default: 'none' 
    },
    notificationSent: { type: Boolean, default: false } // Pour éviter d'envoyer plusieurs notifications
}, { timestamps: true });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
