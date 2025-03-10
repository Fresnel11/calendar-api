const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware')
const { sendWebSocketNotificationToUser } = require('../notificationJob');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');

// Ajouter un événement avec des participants
router.post('/addevents', authMiddleware, async (req, res) => {
    try {
        console.log('Données reçues:', req.body);
        console.log('Utilisateur connecté:', req.body.createdBy);

        const { reminder, participants } = req.body;
        const validReminders = [
            'none', 'at_event_time', '5_min_before', '15_min_before',
            '30_min_before', '1_hour_before', '2_hours_before',
            '12_hours_before', '1_day_before', '1_week_before'
        ];

        // Validation du reminder
        if (reminder && !validReminders.includes(reminder)) {
            return res.status(400).json({ message: 'Reminder invalide. Veuillez choisir une valeur valide.' });
        }

        // Vérification des participants
        if (participants && !Array.isArray(participants)) {
            return res.status(400).json({ message: 'Les participants doivent être un tableau.' });
        }

        // Vérification des participants existants
        const invalidParticipants = [];
        if (participants?.length > 0) {
            for (const participant of participants) {
                const userExists = await User.findById(participant.user);
                if (!userExists) {
                    invalidParticipants.push(participant.user);
                }
            }

            if (invalidParticipants.length > 0) {
                return res.status(404).json({
                    message: `Les participants suivants n'existent pas : ${invalidParticipants.join(', ')}`
                });
            }
        }

        // Création de l'événement
        const newEventData = {
            ...req.body,
            createdBy: req.body.createdBy || null,  // null si pas d'utilisateur connecté
            participants: participants || []
        };

        console.log('Données de l\'événement avant création:', newEventData);

        const newEvent = new Event(newEventData);
        await newEvent.save();

        console.log('Événement créé:', newEvent);

        // Notifications aux participants
        if (newEvent.participants.length > 0) {
            for (const participant of newEvent.participants) {
                // Seul un participant avec statut 'pending' sera notifié
                if (participant.status === 'pending') {
                    const user = await User.findById(participant.user);
                    // Vérifier que l'utilisateur existe et n'est pas le créateur
                    if (user && (!req.user || user._id.toString() !== req.user._id.toString())) {
                        sendWebSocketNotificationToUser(user, newEvent);
                        console.log(`✅ Notification envoyée à ${user.email} pour l'événement : ${newEvent.title}`);
                    } else {
                        console.warn(`⚠️ Notification non envoyée : utilisateur ${participant.user} est le créateur ou introuvable.`);
                    }
                }
            }
        }


        res.status(201).json(newEvent);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'événement:', error);
        res.status(500).json({ message: "Erreur lors de l'ajout de l'événement", error });
    }
});

// router.post('/accept-invite', authMiddleware, async (req, res) => {
//     try {
//         console.log('Requête reçue:', req.body); // Log pour vérifier les données reçues
//         const { eventId } = req.body;
//         const userId = req.user._id;

//         if (!eventId) {
//             return res.status(400).json({ message: "L'ID de l'événement est requis." });
//         }

//         // Trouver l'événement et mettre à jour le statut
//         const event = await Event.findOneAndUpdate(
//             { _id: eventId, "participants.user": userId },
//             { $set: { "participants.$.status": "accepted" } },
//             { new: true }
//         ).populate('participants.user', 'email');

//         if (!event) {
//             console.log(`Événement ${eventId} ou participant ${userId} non trouvé.`);
//             return res.status(404).json({ message: "Événement ou invitation non trouvé." });
//         }

//         // Récupérer le participant concerné
//         const participant = event.participants.find(p => p.user._id.toString() === userId.toString());

//         if (participant.status === "accepted") {
//             sendEventDetailsToUser(participant.user, event);
//             console.log(`✅ Détails de l'événement envoyés à ${participant.user.email}`);
//         } else {
//             console.warn(`⚠️ Statut non mis à jour pour ${participant.user.email}`);
//         }

//         console.log('Réponse envoyée:', { message: "Invitation acceptée avec succès.", event });
//         return res.status(200).json({ message: "Invitation acceptée avec succès.", event });
//     } catch (error) {
//         console.error('Erreur lors de l\'acceptation de l\'invitation:', error);
//         return res.status(500).json({ message: "Erreur serveur lors de l'acceptation.", error: error.message });
//     }
// });






// Récupérer tous les événements
// Récupérer les événements de l'utilisateur connecté
router.get('/events', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Utilisateur non authentifié.' });
        }

        // Récupérer les événements créés par l'utilisateur ou auxquels il participe
        const events = await Event.find({
            $or: [
                { createdBy: req.user._id }, // Événements créés par l'utilisateur
                { 'participants.user': req.user._id } // Événements auxquels l'utilisateur participe
            ]
        })
        .populate('createdBy', 'email') 
        .populate('participants.user', 'email'); 

        console.log('req', req.user._id);

        res.status(200).json(events);
    } catch (error) {
        console.error('Erreur lors de la récupération des événements:', error);
        res.status(500).json({ message: error.message });
    }
});


// Récupérer un événement par son ID
router.get('/event/:id', async (req, res) => {
    try {
        const eventId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }

        const event = await Event.findById(eventId).populate('participants.user', 'email');

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        

        res.status(200).json(event);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'événement:', error);
        res.status(500).json({ message: "Erreur lors de la récupération de l'événement", error });
    }
});

// Modifier un événement
router.put('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }

        const { reminder, ...updateData } = req.body;
        const validReminders = [
            'none', 'at_event_time', '5_min_before', '15_min_before',
            '30_min_before', '1_hour_before', '2_hours_before',
            '12_hours_before', '1_day_before', '1_week_before'
        ];

        if (reminder && !validReminders.includes(reminder)) {
            return res.status(400).json({ message: 'Reminder invalide. Veuillez choisir une valeur valide.' });
        }

        if (reminder) {
            updateData.reminder = reminder;
        }

        const updatedEvent = await Event.findByIdAndUpdate(eventId, updateData, { new: true });

        if (!updatedEvent) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error('Erreur lors de la modification de l\'événement:', error);
        res.status(500).json({ message: 'Erreur lors de la modification de l\'événement', error });
    }
});

// Supprimer un événement par ID
router.delete('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }

        const deletedEvent = await Event.findByIdAndDelete(eventId);

        if (!deletedEvent) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        res.status(200).json({ message: 'Événement supprimé avec succès', deletedEvent });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'événement:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'événement', error });
    }
});

// Répondre à l'invitation d'un événement
router.post('/respond/:eventId', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body; // 'accepted' ou 'declined'
        const eventId = req.params.eventId;
        const userId = req.user._id;

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        // Trouver le participant et mettre à jour son statut
        const participant = event.participants.find(p => p.user.toString() === userId.toString());
        if (participant) {
            participant.status = status;
            await event.save();
            return res.status(200).json({ message: 'Réponse enregistrée.' });
        } else {
            return res.status(404).json({ message: 'Vous n\'êtes pas un participant à cet événement.' });
        }

    } catch (error) {
        console.error('Erreur de réponse à l\'invitation:', error);
        res.status(500).json({ message: 'Erreur lors de la réponse à l\'invitation', error });
    }
});

router.get('/users/search', async (req, res) => {
    try {
        const { email } = req.query;
        const users = await User.find({ email: { $regex: email, $options: 'i' } }).limit(5); // Limite les résultats à 5
        res.json(users);
    } catch (error) {
        console.error('Erreur lors de la recherche des utilisateurs:', error);
        res.status(500).json({ message: 'Erreur lors de la recherche des utilisateurs', error });
    }
});




module.exports = router;
