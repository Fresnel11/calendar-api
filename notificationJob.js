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

    // Permettre au client d'envoyer son ID utilisateur après connexion
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.userId) {
                ws.userId = data.userId;
                console.log(`👤 Utilisateur connecté avec l'ID: ${ws.userId}`);
            }
        } catch (error) {
            console.error('❌ Erreur de parsing du message WebSocket:', error);
        }
    });
});

// Fonction pour envoyer une notification en temps réel
const sendWebSocketNotification = (event) => {
    let message;

    if (event.reminder === 'at_event_time') {
        message = `🔔 C'est l'heure ! L'événement "${event.title}" commence maintenant.`;
    } else {
        message = `⏰ Rappel : "${event.title}" approche ! (${event.reminder.replace('_', ' ')})`;
    }

    console.log(`📢 Envoi de notification WebSocket à tous les clients: ${message}`);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ message, event }));
        }
    });
};

// Fonction pour envoyer une notification à un utilisateur spécifique (invitation à un événement)
const sendWebSocketNotificationToUser = (user, event) => {
    console.log(`🔍 Tentative d'envoi de notification WebSocket à ${user.email} (ID: ${user._id})`);

    const message = `📩 Vous avez été invité à participer à l'événement "${event.title}". Acceptez-vous l'invitation ?`;

    let found = false;

    wss.clients.forEach(client => {
        console.log('found user', user);
        
        if (client.readyState === WebSocket.OPEN ) {
            console.log(`📡 Vérification du client WebSocket avec userId: ${client.userId}`);
            client.send(JSON.stringify({ message, event, action: 'invite' }));
            found = true;
        }
    });

    if (found) {
        console.log(`✅ Notification envoyée à ${user.email} (ID: ${user._id})`);
    } else {
        console.warn(`⚠️ Aucun client WebSocket trouvé pour ${user.email} (ID: ${user._id})`);
    }
};


// Fonction pour calculer le moment du rappel
const getReminderTime = (event) => {
    if (!event.startTime || typeof event.startTime !== 'string' || !event.startTime.includes(':')) {
        throw new Error('startTime est invalide ou manquant. Veuillez fournir un format valide "HH:MM".');
    }

    const eventDate = new Date();
    const [hours, minutes] = event.startTime.split(':');
    eventDate.setHours(hours, minutes, 0, 0);

    const eventTime = eventDate.getTime();
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

    console.log(`⏱️ Calcul du rappel pour "${event.title}":`);
    console.log(`   - Heure de l'événement : ${new Date(eventTime)}`);
    console.log(`   - Rappel (${event.reminder}) : ${new Date(reminderTime)}`);
    console.log(`   - Heure actuelle : ${new Date()}`);

    return reminderTime;
};

// Vérification des rappels toutes les minutes
schedule.scheduleJob('* * * * *', async () => {
    console.log(' Vérification des rappels...');

    const now = Date.now();
    const events = await Event.find({ reminder: { $ne: 'none' }, notificationSent: false });

    for (const event of events) {
        const reminderTime = getReminderTime(event);

        if (reminderTime <= now && reminderTime > (now - 1000 * 60)) { // Vérifie si l'événement doit être notifié dans la minute
            console.log(`⏰ Envoi de la notification pour : ${event.title}`);

            sendWebSocketNotification(event);

            event.notificationSent = true;
            await event.save();
            console.log(`✅ Notification envoyée et événement marqué comme notifié : ${event.title}`);
        }
    }
});

console.log('📅 Job de notification activé...');

module.exports = {
    sendWebSocketNotificationToUser
};
