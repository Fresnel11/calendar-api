const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 }); // Le WebSocket écoute sur le port 8080

// Lorsqu'un client se connecte
wss.on('connection', (ws) => {
    console.log('Un nouveau client est connecté au WebSocket!');
    
    // Envoi d'une notification toutes les 5 secondes (simule une notification)
    setInterval(() => {
        ws.send(JSON.stringify({ message: 'Nouvelle notification!', type: 'info' }));
    }, 5000);
    
    // Recevoir un message du client
    ws.on('message', (message) => {
        console.log('Message reçu:', message);
    });
});
