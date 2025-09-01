const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    downloadMediaMessage,
} = require('@whiskeysockets/baileys');

const P = require('pino');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');

const authFolder = './auth_info';
const error_img = path.join(__dirname, './assets/media/img/error.png'); // Ruta de imagen de error

var img_links = "https://raw.githubusercontent.com/skriftna/BOT/refs/heads/main/"
// Función para enviar imagen de error
function sendErrorImage(sock, sender, msg, error, cmd) {
    try {
        const imageBuffer = fs.readFileSync(error_img);
        sock.sendMessage(sender, {
            image: imageBuffer,
            caption: `*|════| 𝐄𝐑𝐑𝐎𝐑 |════|*

*🔑 CMD:*
> ═> ${cmd}
*📞 TRL:*
> ═> ${error}`
        }, { quoted: msg });
    } catch (err) {
        console.error("❌ Error al enviar imagen de error:", err.message);
    }
}

async function mensaje(comando, img, texto) {
    const imageUrl = img;
    try {
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imageRes.data, 'binary');

        await sock.sendMessage(sender, {
            image: buffer,
            caption: texto,
        }, { quoted: msg });

        console.log("✅ comando: " + comando);
    } catch (err){
        console.error("❌ Error al enviar:", err.message);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P().child({ level: 'silent' })),
        },
    });

    // QR
    sock.ev.on("connection.update", (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log("📲 Escanea el código QR con WhatsApp:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Bot conectado a WhatsApp.");
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Conexión cerrada. ¿Reiniciar?", shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // Mensajes entrantes
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const user = text.trim().toLowerCase();

        console.log(`📩 Mensaje de ${sender}: ${text}`);

        if (user === "!hola") {
            const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/fotos-b8a54.appspot.com/o/517410938_122175310514383922_6719064626741466107_n.jpg?alt=media&token=f3cd070e-46ec-48be-a7af-85f90b4729c8';

            try {
                const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imageRes.data, 'binary');

                await sock.sendMessage(sender, {
                    image: buffer,
                    caption: `----`,
                }, { quoted: msg });

                console.log("✅ Imagen y texto enviados correctamente.");
            } catch (err) {
                sendErrorImage(sock, sender, msg);
            }
        }

        // Comando: !voz
        if (user === "!voz") {
            try {
                const audioPath = path.join(__dirname, 'audios', 'saludo.mp3');
                const audioBuffer = fs.readFileSync(audioPath);

                await sock.sendMessage(sender, {
                    audio: audioBuffer,
                    mimetype: 'audio/mp4',
                    ptt: true
                }, { quoted: msg });

                console.log("✅ Audio enviado correctamente.");
            } catch (err) {
                sendErrorImage(sock, sender, msg);
            }
        }

        // Comando: !encender
        if (user === "!encender" || user === "!cargar") {
            exec('python assets/plugins/carga/encender.py', (err, stdout, stderr) => {
                const salida = stdout.trim();

                if (err || salida.startsWith("Error") || salida.includes("Error")) {
                    sendErrorImage(sock, sender, msg, stdout, "!encender");
                } else {
                    sock.sendMessage(sender, {
                        text: salida || "Sin salida."
                    }, { quoted: msg });
                }
            });
        }

        // Comando: !apagar
        if (user === "!apagar") {
            exec('python assets/plugins/carga/apagar.py', (err, stdout, stderr) => {
                const salida = stdout.trim();
                if (err || salida === "Error") {
                    sendErrorImage(sock, sender, msg);
                } else {
                    sock.sendMessage(sender, {
                        text: salida || "Sin salida."
                    }, { quoted: msg });
                }
            });
        }
    });

    // Bienvenida a nuevos miembros
    sock.ev.on("group-participants.update", async (update) => {
        const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/fotos-b8a54.appspot.com/o/517410938_122175310514383922_6719064626741466107_n.jpg?alt=media&token=f3cd070e-46ec-48be-a7af-85f90b4729c8';
        const { id, participants, action } = update;

        if (action === 'add') {
            try {
                const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imageRes.data, 'binary');

                for (const user of participants) {
                    await sock.sendMessage(id, {
                        image: buffer,
                        caption: `👋 ¡Bienvenido @${user.split('@')[0]} al grupo!`,
                        mentions: [user],
                    });
                }
            } catch (err) {
                console.error("❌ Error al enviar imagen de bienvenida:", err.message);
            }
        }
    });
}

async function main() {
    while (true) {
        try {
            await startBot();
            break;
        } catch (err) {
            console.error("❌ Error crítico:", err.message);
            console.log("🔄 Reiniciando bot en 4 segundos...");
            await new Promise(res => setTimeout(res, 4000));
        }
    }
}

main();
