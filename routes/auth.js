const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();

// Route d'inscription
// Route d'inscription
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "L'email et le mot de passe sont requis." });
    }

    // Vérifie si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Utilisateur déjà existant" });

    try {
        const newUser = new User({ email, password });
        await newUser.save();
        
        // Générer un token immédiatement après l'inscription
        const token = jwt.sign({ userId: newUser._id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({ success: true, token });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
});


// Route de connexion
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Recherche de l'utilisateur
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Utilisateur non trouvé' });

    // Comparaison du mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Mot de passe incorrect' });

    // Générer un JWT (Token)
    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({ success: true, token });
});

// Route de déconnexion (Suppression du token côté client)
router.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Déconnexion réussie. Supprimez le token côté client.' });
});

module.exports = router;
