const mongoose = require('mongoose');
const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const WebSocket = require('ws');
const Event = require('./models/Event');
require('dotenv').config();

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🔗 Connecté à MongoDB'))
    .catch(err => console.error('❌ Erreur de connexion MongoDB', err));

// WebSocket Server (Notifications en temps réel)
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', ws => {
    console.log('🟢 Client WebSocket connecté');
});

// Fonction pour envoyer une notification en temps réel
const sendWebSocketNotification = (event) => {
    let message;

    if (event.reminder === 'at_event_time') {
        message = `🔔 C'est l'heure ! L'événement "${event.title}" commence maintenant.`;
    } else {
        message = `⏰ Rappel : "${event.title}" approche ! (${event.reminder.replace('_', ' ')})`;
    }

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ message, event }));
        }
    });
};


// Fonction pour envoyer un email de rappel
const sendEmailNotification = async (event) => {
    const transporter = nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
            user: "3a20dd5c090263",
            pass: "fc054ab0d9c60b"
        }
    });


    const mailOptions = {
        from: "3a20dd5c090263",
        to: 'fresneljeanclaudecossou64@gmail.com',
        subject: `Rappel : ${event.title}`,
        text: `Votre événement "${event.title}" est prévu le ${new Date(event.startDate).toLocaleString()}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email envoyé pour ${event.title}`);
    } catch (error) {
        console.error('❌ Erreur envoi email', error);
    }
};

// Fonction pour calculer le moment du rappel
const getReminderTime = (event) => {
    // Créer un objet Date avec la date d'aujourd'hui et l'heure de l'événement
    const eventDate = new Date();
    const [hours, minutes] = event.startTime.split(':'); // Sépare l'heure et les minutes de startTime
    eventDate.setHours(hours, minutes, 0, 0); // Définit l'heure et les minutes sur la date actuelle

    const eventTime = eventDate.getTime(); // Convertit la date en millisecondes
    const reminderMap = {
        'at_event_time': 0,
        '5_min_before': 5 * 60 * 1000,
        '15_min_before': 15 * 60 * 1000,
        '30_min_before': 30 * 60 * 1000,
        '1_hour_before': 60 * 60 * 1000,
        '2_hours_before': 2 * 60 * 60 * 1000,
        '12_hours_before': 12 * 60 * 60 * 1000,
        '1_day_before': 24 * 60 * 60 * 1000,
        '1_week_before': 7 * 24 * 60 * 60 * 1000
    };

    const reminderTime = eventTime - (reminderMap[event.reminder] || 0);

    // Logs pour afficher les détails
    console.log(`⏱️ Calcul du rappel pour ${event.title}: `);
    console.log(`   - Heure de l'événement : ${new Date(eventTime)}`);
    console.log(`   - Rappel (${event.reminder}) : ${new Date(reminderTime)}`);
    console.log(`   - Heure actuelle : ${new Date()}`);

    return reminderTime;
};



// Vérification des rappels toutes les minutes
schedule.scheduleJob('* * * * *', async () => {
    console.log('🔎 Vérification des rappels...');

    const now = Date.now();
    const events = await Event.find({ reminder: { $ne: 'none' }, notificationSent: false });

    events.forEach(async (event) => {
        const reminderTime = getReminderTime(event);
        if (reminderTime <= now && reminderTime > (now - 1000 * 60)) { // Événements dans la minute
            console.log(`⏰ Envoi de la notification pour : ${event.title}`);

            sendWebSocketNotification(event);
            await sendEmailNotification(event);

            // Marquer l'événement comme notifié
            event.notificationSent = true;
            await event.save();
            console.log(`✅ Notification envoyée et événement marqué comme notifié : ${event.title}`);
        }
    });

});

console.log('📅 Job de notification activé...');
