const { spawn } = require('child_process');
const { serverConfig } = require('../server_config');
const { logDebug, logError, logInfo, logWarn, logFfmpeg } = require('../console');
const checkFFmpeg = require('./checkFFmpeg');
const { PassThrough } = require('stream');

const consoleLogTitle = '[Audio Stream]';

let startupSuccess;

function connectMessage(message) {
    if (!startupSuccess) {
        logInfo(message);
        startupSuccess = true;
    }
}

const audio_pipe = new PassThrough();

checkFFmpeg().then((ffmpegPath) => {
    logInfo(`${consoleLogTitle} Using ${ffmpegPath === 'ffmpeg' ? 'system-installed FFmpeg' : 'ffmpeg-static'}`);
    logInfo(`${consoleLogTitle} Starting audio stream on device: \x1b[35m${serverConfig.audio.audioDevice}\x1b[0m`);

    const sampleRate = Number(serverConfig.audio.sampleRate || 44100) + Number(serverConfig.audio.samplerateOffset || 0); // Maybe even do 32 khz, we do not need higher than 15 khz precision

    const channels = Number(serverConfig.audio.audioChannels || 2);

    let ffmpeg = null;
    let restartTimer = null;
    let lastTimestamp = null;
    let staleCount = 0;
    let lastCheckTime = Date.now();

    function buildArgs() {
        const device = serverConfig.audio.audioDevice;

        let inputArgs;

        if (process.platform === 'win32') inputArgs = ["-f", "dshow", "-i", `audio=${device}`];
        else if (process.platform === 'darwin') inputArgs = ["-f", "avfoundation", "-i", device || ":0"];
        else inputArgs = ["-f", "alsa", "-i", device];

        return [
            "-fflags", "+flush_packets",
            "-flags", "low_delay",
            "-rtbufsize", "4096",
            "-probesize", "128",

            ...inputArgs,

            "-thread_queue_size", "1536",
            "-ar", String(sampleRate),
            "-ac", String(channels),

            "-c:a", "libmp3lame",
            "-b:a", serverConfig.audio.audioBitrate,
            "-ac", String(channels),
            "-reservoir", "0",

            "-f", "mp3",
            "-write_xing", "0",
            "-id3v2_version", "0",

            "-fflags", "+nobuffer",
            "-flush_packets", "1",

            "pipe:1"
        ];
    }

    function launchFFmpeg() {
        const args = buildArgs();

        logDebug(`${consoleLogTitle} Launching FFmpeg with args: ${args.join(' ')}`);

        ffmpeg = spawn(ffmpegPath, args, {stdio: ['ignore', 'pipe', 'pipe']});

        ffmpeg.stdout.pipe(audio_pipe, { end: false });

        connectMessage(`${consoleLogTitle} Connected FFmpeg → MP3 → audioWss`);

        ffmpeg.stderr.on('data', (data) => {
            const msg = data.toString();
            logFfmpeg(`[FFmpeg stderr]: ${msg}`);

            // Detect frozen timestamps
            const match = msg.match(/time=(\d\d):(\d\d):(\d\d\.\d+)/);
            if (match) {
                const [_, hh, mm, ss] = match;
                const totalSec = parseInt(hh) * 3600 + parseInt(mm) * 60 + parseFloat(ss);

                if (lastTimestamp !== null && totalSec === lastTimestamp) {
                    staleCount++;
                    const now = Date.now();

                    if (staleCount >= 10 && now - lastCheckTime > 10000 && !restartTimer) {
                        logWarn(`${consoleLogTitle} FFmpeg appears frozen. Restarting...`);

                        restartTimer = setTimeout(() => {
                            restartTimer = null;
                            staleCount = 0;
                            try {
                                ffmpeg.kill('SIGKILL');
                            } catch (e) {
                                logWarn(`${consoleLogTitle} Failed to kill FFmpeg: ${e.message}`);
                            }
                            launchFFmpeg();
                        }, 0);
                    }
                } else {
                    lastTimestamp = totalSec;
                    lastCheckTime = Date.now();
                    staleCount = 0;
                }
            }
        });

        ffmpeg.on('exit', (code, signal) => {
            if (signal) logWarn(`${consoleLogTitle} FFmpeg killed with signal ${signal}`);
            else if (code !== 0) logWarn(`${consoleLogTitle} FFmpeg exited with code ${code}`);

            logWarn(`${consoleLogTitle} Restarting FFmpeg in 5 seconds...`);
            setTimeout(launchFFmpeg, 5000);
        });
    }

    process.on('SIGINT', () => {
        if (ffmpeg) ffmpeg.kill('SIGINT');
        process.exit();
    });

    process.on('exit', () => {
        if (ffmpeg) ffmpeg.kill('SIGINT');
    });

    launchFFmpeg();

}).catch((err) => {
    logError(`${consoleLogTitle} Error: ${err.message}`);
});

module.exports = audio_pipe;