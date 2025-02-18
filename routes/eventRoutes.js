const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');


// Ajouter un événement
router.post('/addevents', async (req, res) => {
    try {
        console.log('Données reçues:', req.body);

        // Vérifier que le rappel (reminder) est bien une des valeurs autorisées
        const { reminder } = req.body;
        const validReminders = [
            'none', 'at_event_time', '5_min_before', '15_min_before',
            '30_min_before', '1_hour_before', '2_hours_before',
            '12_hours_before', '1_day_before', '1_week_before'
        ];

        if (reminder && !validReminders.includes(reminder)) {
            return res.status(400).json({ message: 'Reminder invalide. Veuillez choisir une valeur valide.' });
        }

        const newEvent = new Event(req.body);
        await newEvent.save();

        res.status(201).json(newEvent);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'événement:', error);
        res.status(500).json({ message: "Erreur lors de l'ajout de l'événement", error });
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

        // Convertir l'ID en ObjectId valide
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }

        const event = await Event.findById(eventId);

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

        // Vérifier que l'ID est valide
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'ID invalide' });
        }

        // Vérifier la validité du champ reminder s'il est fourni
        const { reminder, ...updateData } = req.body;
        const validReminders = [
            'none', 'at_event_time', '5_min_before', '15_min_before',
            '30_min_before', '1_hour_before', '2_hours_before',
            '12_hours_before', '1_day_before', '1_week_before'
        ];

        if (reminder && !validReminders.includes(reminder)) {
            return res.status(400).json({ message: 'Reminder invalide. Veuillez choisir une valeur valide.' });
        }

        // Appliquer la mise à jour
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
        const eventId = req.params.id; // Récupérer l'ID de l'événement dans l'URL

        // Convertir l'ID en ObjectId valide
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



module.exports = router;
