const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();

// Route d'inscription
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Vérification des champs obligatoires
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Le nom d'utilisateur, l'email et le mot de passe sont requis." });
    }

    // Vérifier que le username respecte les règles (exemple : 3-15 caractères alphanumériques)
    const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ message: "Le nom d'utilisateur doit contenir entre 3 et 15 caractères alphanumériques." });
    }

    // Vérifier que le mot de passe respecte les règles (exemple : minimum 8 caractères, au moins une majuscule et un chiffre)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre." });
    }

    // Vérifie si l'utilisateur existe déjà (par email ou username)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ message: "Email ou nom d'utilisateur déjà utilisé." });

    try {
        const newUser = new User({ username, email, password });
        await newUser.save();
        
        // Générer un token immédiatement après l'inscription
        const token = jwt.sign(
            { userId: newUser._id, email: newUser.email, username: newUser.username, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ success: true, token });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error });
    }
});

// Route de connexion (avec email ou username)
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body; // `identifier` peut être un email ou un username

    if (!identifier || !password) {
        return res.status(400).json({ message: "L'email/nom d'utilisateur et le mot de passe sont requis." });
    }

    // Recherche de l'utilisateur par email ou username
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) return res.status(400).json({ message: "Utilisateur non trouvé." });

    // Comparaison du mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Mot de passe incorrect." });

    // Générer un JWT (Token)
    const token = jwt.sign(
        { userId: user._id, email: user.email, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.status(200).json({ success: true, token });
});

// Route de déconnexion (Suppression du token côté client)
router.post('/logout', (req, res) => {
    res.status(200).json({ message: "Déconnexion réussie. Supprimez le token côté client." });
});

module.exports = router;
