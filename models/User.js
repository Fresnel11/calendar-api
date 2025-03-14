const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Schéma de l'utilisateur
const userSchema = new mongoose.Schema({
    username: { type: String, required: true }, // Ajout du champ name obligatoire
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Rôle avec valeurs possibles user/admin
}, { timestamps: true });

// Méthode pour comparer le mot de passe avec celui dans la base de données
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Hachage du mot de passe avant la sauvegarde
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
