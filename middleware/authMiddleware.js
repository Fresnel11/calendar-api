const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        // Récupérer le token de différentes façons possibles
        const token = req.headers.authorization?.split(' ')[1] ||
            req.body.token ||
            req.query.token ||
            req.cookies?.auth_token;

        if (!token) {
            // Pas de token = utilisateur non connecté
            req.user = null;
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (user) {
                req.user = user;
            } else {
                req.user = null;
            }
        } catch (error) {
            // Token invalide = utilisateur non connecté
            req.user = null;
        }

        next();
    } catch (error) {
        console.error('Erreur dans le middleware d\'authentification:', error);
        req.user = null;
        next();
    }
};

module.exports = authMiddleware;