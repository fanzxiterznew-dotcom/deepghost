const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Mematikan QR Code untuk menggunakan Pairing Code
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // Proses Pairing Code jika belum ada sesi terhubung
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Masukkan Nomor WhatsApp Anda (contoh: 6281234567890): ');
        const cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        setTimeout(async () => {
            const code = await sock.requestPairingCode(cleanedNumber);
            console.log(`\n====================================`);
            console.log(`KODE PAIRING WHATSAPP ANDA: ${code}`);
            console.log(`====================================\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot WhatsApp Berhasil Terhubung!');
        }
    });

    // Menangani Pesan Masuk
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        // Perintah .menu
        if (textMessage.trim().toLowerCase() === '.menu') {
            const captionText = `
*🤖 VEXUS ANIME BOT MENU 🤖*

Selamat datang di Sistem Otomatisasi WA.
Berikut fitur yang tersedia:

┌─── ◈ *FITUR UTAMA* ◈
│ ├ .menu (Menampilkan Menu Ini)
│ ├ .ping (Cek Respon Bot)
│ ├ .owner (Kontak Pengembang)
│ └ .info (Informasi Server Bot)
└───

✨ *Powered by Baileys & GitHub Cloud*
`;

            // Mengirimkan Menu Berwujud Kartu Lokasi Palsu (Fake Location) + Gambar Anime
            await sock.sendMessage(from, {
                location: {
                    degreesLatitude: 35.6762,  // Koordinat Tokyo, Jepang
                    degreesLongitude: 139.6503,
                    name: "Akihabara Anime Center ⛩️",
                    address: "Tokyo, Japan"
                },
                caption: captionText.trim(),
                jpegThumbnail: await getBuffer("https://files.catbox.moe/k9m614.jpg") // Gambar Thumbnail Anime
            }, { quoted: msg });
        }
        
        // Perintah Tes .ping
        if (textMessage.trim().toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: 'Pong! 🏓 Bot Aktif 24/7!' }, { quoted: msg });
        }
    });
}

// Helper untuk fetch buffer gambar
async function getBuffer(url) {
    const axios = require('axios');
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return res.data;
}

startBot();
