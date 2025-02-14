require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const eventRoutes = require('./routes/eventRoutes')

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use('/api', eventRoutes)

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connecté ✅'))
    .catch(err => console.error('Erreur de connexion à MongoDB ❌', err));



// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT} 🚀`));
