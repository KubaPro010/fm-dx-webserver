const WebSocket = require('ws');
const { serverConfig } = require('../server_config');
const { audio_pipe } = require('./index.js');

function createAudioServer() {
    const audioWss = new WebSocket.Server({ noServer: true });

    audioWss.on('connection', (ws, request) => {
        const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

        if (serverConfig.webserver.banlist?.includes(clientIp)) {
            ws.close(1008, 'Banned IP');
            return;
        }
    });

    audio_pipe.on('data', (chunk) => {
        audioWss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(chunk, {binary: true, compress: false });
        });
    });

    audio_pipe.on('end', () => {
        audioWss.clients.forEach((client) => {
            client.close(1001, "Audio stream ended");
        });
    });

    return audioWss;
}

module.exports = { createAudioServer };