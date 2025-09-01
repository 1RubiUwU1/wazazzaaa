// bot.cjs
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const P = require('pino');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const express = require('express');

const PORT = process.env.PORT || 8080;

// Carpeta de credenciales locales
const authFolder = './auth_info';
if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

// Imagen de error
const error_img = path.join(__dirname, './assets/media/img/error.png');

async function sendErrorImage(sock, sender, msg, error, cmd) {
    try {
        const imageBuffer = fs.readFileSync(error_img);
        await sock.sendMessage(sender, {
            image: imageBuffer,
            caption: `*|════| 𝐄𝐑𝐑𝐎𝐑 |════|*\n\n*🔑 CMD:*\n> ═> ${cmd || "N/A"}\n*📞 TRL:*\n> ═> ${error || "Error desconocido"}`
        }, { quoted: msg });
    } catch (err) {
        console.error("❌ Error al enviar imagen de error:", err.message);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P().child({ level: 'silent' })),
        },
    });

    console.log("✅ Bot iniciado.");

    // Conexión
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === "open") console.log("✅ Conectado a WhatsApp.");
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Conexión cerrada. ¿Reiniciar?", shouldReconnect);
            if (shouldReconnect) setTimeout(startBot, 5000); // reconectar tras 5s
        }
        if (qr) console.log("📲 Escanea este QR en tu WhatsApp para iniciar sesión.");
    });

    sock.ev.on("creds.update", saveCreds);

    // Mensajes
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const user = text.trim().toLowerCase();

        console.log(`📩 Mensaje de ${sender}: ${text}`);

        // Comando !hola
        if (user === "!hola") {
            const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/fotos-b8a54.appspot.com/o/517410938_122175310514383922_6719064626741466107_n.jpg?alt=media';
            try {
                const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                await sock.sendMessage(sender, { image: Buffer.from(imageRes.data, 'binary'), caption: "----" }, { quoted: msg });
            } catch (err) { sendErrorImage(sock, sender, msg, err.message, "!hola"); }
        }

        // Comando !voz
        if (user === "!voz") {
            try {
                const audioPath = path.join(__dirname, 'audios', 'saludo.mp3');
                const audioBuffer = fs.readFileSync(audioPath);
                await sock.sendMessage(sender, { audio: audioBuffer, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
            } catch (err) { sendErrorImage(sock, sender, msg, err.message, "!voz"); }
        }

        // Comando !encender
        if (user === "!encender" || user === "!cargar") {
            exec('python assets/plugins/carga/encender.py', (err, stdout, stderr) => {
                const salida = stdout.trim();
                if (err || salida.startsWith("Error") || salida.includes("Error")) sendErrorImage(sock, sender, msg, salida, "!encender");
                else sock.sendMessage(sender, { text: salida || "Sin salida." }, { quoted: msg });
            });
        }

        // Comando !apagar
        if (user === "!apagar") {
            exec('python assets/plugins/carga/apagar.py', (err, stdout, stderr) => {
                const salida = stdout.trim();
                if (err || salida.includes("Error")) sendErrorImage(sock, sender, msg, salida, "!apagar");
                else sock.sendMessage(sender, { text: salida || "Sin salida." }, { quoted: msg });
            });
        }
    });

    // Bienvenida a nuevos miembros
    sock.ev.on("group-participants.update", async (update) => {
        const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/fotos-b8a54.appspot.com/o/517410938_122175310514383922_6719064626741466107_n.jpg?alt=media';
        const { id, participants, action } = update;

        if (action === 'add') {
            try {
                const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imageRes.data, 'binary');
                for (const user of participants) {
                    await sock.sendMessage(id, { image: buffer, caption: `👋 ¡Bienvenido @${user.split('@')[0]}!`, mentions: [user] });
                }
            } catch (err) { console.error("❌ Error enviando bienvenida:", err.message); }
        }
    });
}

// Express simple para Railway (keep alive)
const app = express();
app.get("/", (req, res) => res.send("🌐 Servidor activo"));
app.listen(PORT, () => console.log(`🌐 Servidor HTTP activo en puerto ${PORT}`));

// Ejecuta el bot
startBot().catch(err => console.error("❌ Error crítico al iniciar el bot:", err));
