const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware')


router.get('/notifications', authMiddleware,async (req, res) => {
    try {
        const userId = req.user._id;
        console.log('userId', userId);


        // Récupérer uniquement les notifications de l'utilisateur actuel
        const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }); // Trier par date décroissante
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.post('/notifications/mark-as-read/:id', async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ error: 'Notification non trouvée' });

        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: 'Notification supprimée après lecture' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/notifications/respond-invite/:id', async (req, res) => {
    try {
        const { response } = req.body; // 'accept' ou 'decline'
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ error: 'Notification non trouvée' });

        if (response === 'accept') {
            console.log(`✅ Invitation acceptée pour l'événement ID: ${notification.eventId}`);
        } else {
            console.log(`❌ Invitation refusée pour l'événement ID: ${notification.eventId}`);
        }

        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: 'Notification d’invitation supprimée' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
