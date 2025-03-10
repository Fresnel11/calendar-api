const mongoose = require('mongoose');
const schedule = require('node-schedule');
const WebSocket = require('ws');
const Event = require('./models/Event');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const Notification = require('./models/Notification');
require('dotenv').config();

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🔗 Connecté à MongoDB'))
    .catch(err => console.error('❌ Erreur de connexion MongoDB', err));

// WebSocket Server (Notifications en temps réel)
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        ws.close();
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        ws.userId = decoded.userId;
        console.log(`WebSocket connecté pour l'utilisateur ${ws.userId}`);
    } catch (err) {
        console.error('Token WebSocket invalide:', err);
        ws.close();
    }

    ws.on('error', console.error);
});


// Fonction pour envoyer une notification en temps réel
const sendWebSocketNotification = async(event) => {
    let message;

    if (event.reminder === 'at_event_time') {
        message = `🔔 C'est l'heure ! L'événement "${event.title}" commence maintenant.`;
    } else {
        message = `⏰ Rappel : "${event.title}" approche ! (${event.reminder.replace('_', ' ')})`;
    }

    console.log(`📢 Envoi de notification WebSocket à tous les clients: ${message}`);

    // Sauvegarde en base de données
    await Notification.create({
        userId: event.userId,  // Assure-toi que chaque événement a un userId associé
        eventId: event._id,
        type: 'reminder',
        message: message
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ message, event }));
        }
    });
};

// Fonction pour envoyer une notification à un utilisateur spécifique (invitation à un événement)
const sendWebSocketNotificationToUser = async (targetUser, event) => {
    console.log(`🔍 Tentative d'envoi de notification WebSocket à ${targetUser.email} (ID: ${targetUser._id})`);

    // Récupérer l'utilisateur qui a créé l'événement
    const creator = await User.findById(event.createdBy).select('email');

    if (!creator) {
        console.warn(`⚠️ Impossible de trouver le créateur de l'événement ${event._id}`);
        return;
    }

    const message = `Vous avez été ajouté à l'évènement "${event.title}" par "${creator.email}". Si vous n'êtes pas intéressé, veuillez supprimer l'évènement.`;

    // Sauvegarde de la notification en base de données
    await Notification.create({
        userId: targetUser._id,
        eventId: event._id,
        type: 'invite',
        message: message
    });

    let found = false;

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === targetUser._id.toString()) {
            console.log(`📡 Envoi de notification au client WebSocket avec userId: ${client.userId}`);
            client.send(JSON.stringify({
                message,
                event,
                action: 'invite',
                targetUserId: targetUser._id,
                createdByEmail: creator.email // Ajout de l'email du créateur dans la réponse
            }));
            found = true;
        }
    });

    if (found) {
        console.log(`✅ Notification envoyée à ${targetUser.email} (ID: ${targetUser._id})`);
    } else {
        console.warn(`⚠️ Aucun client WebSocket trouvé pour ${targetUser.email} (ID: ${targetUser._id})`);
    }
};


// const sendWebSocketNotificationToUser = async (targetUser, event) => {
//     console.log(`🔍 Tentative d'envoi de notification WebSocket à ${targetUser.email} (ID: ${targetUser._id})`);

//     const message = `Vous avez été ajouté à l'évènement "${event.title}" par "${event.createdBy}". Si vous n'êtes pas intéréssé veuillez supprimer l'évènement.`; ;

//     // Sauvegarde de la notification en base de données
//     await Notification.create({
//         userId: targetUser._id,
//         type: 'invite',
//         message: message
//     });

//     let found = false;

//     wss.clients.forEach(client => {
//         if (client.readyState === WebSocket.OPEN && client.userId === targetUser._id.toString()) {
//             console.log(`📡 Envoi de notification au client WebSocket avec userId: ${client.userId}`);
//             client.send(JSON.stringify({
//                 message,
//                 action: 'invite',
//                 targetUserId: targetUser._id 
//             }));
//             found = true;
//         }
//     });

//     if (found) {
//         console.log(`✅ Notification envoyée à ${targetUser.email} (ID: ${targetUser._id})`);
//     } else {
//         console.warn(`⚠️ Aucun client WebSocket trouvé pour ${targetUser.email} (ID: ${targetUser._id})`);
//     }
// };


// const sendEventDetailsToUser = async (targetUser, event) => {
//     console.log(`🔍 Envoi des détails de l'événement à ${targetUser.email} (ID: ${targetUser._id})`);

//     wss.clients.forEach(client => {
//         if (client.readyState === WebSocket.OPEN && client.userId === targetUser._id.toString()) {
//             client.send(JSON.stringify({
//                 message: `🎉 Vous avez accepté l'invitation à l'événement "${event.title}".`,
//                 event, 
//                 action: 'event_details',
//                 targetUserId: targetUser._id
//             }));
//         }
//     });
// };



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
