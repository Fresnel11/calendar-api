require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const eventRoutes = require('./routes/eventRoutes');
const authRoutes = require('./routes/auth');
const MongoStore = require('connect-mongo');
const session = require('express-session');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/api', eventRoutes);
app.use('/api/auth', authRoutes);

app.use(session({
    secret: process.env.SESSION_SECRET, // Une clé secrète pour signer les sessions
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI, // Stockage des sessions dans MongoDB
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // Durée de session : 1 jour
        httpOnly: true, // Sécurise contre les attaques XSS
        secure: false // Mettre à `true` en production avec HTTPS
    }
}));

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connecté ✅'))
    .catch(err => console.error('Erreur de connexion à MongoDB ❌', err));

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT} 🚀`));
