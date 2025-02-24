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
        console.log('Utilisateur connecté:', req.user);

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
                if (participant.status === 'pending') {
                    const user = await User.findById(participant.user);
                    if (user) {
                        // Passer l'ID du créateur pour exclure l'utilisateur créateur
                        sendWebSocketNotificationToUser(user, newEvent);
                        console.log(`✅ Notification envoyée à ${user.email} pour l'événement : ${newEvent.title}`);
                    } else {
                        console.warn(`⚠️ Impossible d'envoyer une notification : utilisateur ${participant.user} introuvable.`);
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









// Ajouter un participant à un événement
router.post('/events/:id/addParticipant', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { userId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        // Vérifier si l'événement est lié à un utilisateur
        if (!event.createdBy) {
            return res.status(403).json({ message: 'Impossible d\'ajouter des participants à un événement anonyme.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Vérifier si l'utilisateur est déjà un participant
        const isAlreadyParticipant = event.participants.some(p => p.user.toString() === userId);
        if (isAlreadyParticipant) {
            return res.status(400).json({ message: 'Cet utilisateur est déjà un participant.' });
        }

        // Ajouter le participant
        event.participants.push({ user: userId, status: 'pending' });
        await event.save();

        res.status(200).json({ message: 'Participant ajouté avec succès', event });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un participant:', error);
        res.status(500).json({ message: 'Erreur lors de l\'ajout d\'un participant', error });
    }
});

// Récupérer tous les événements
router.get('/events', async (req, res) => {
    try {
        const events = await Event.find();
        res.status(200).json(events);
    } catch (error) {
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

        const event = await Event.findById(eventId).populate('participants.user', 'name email');

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
