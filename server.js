require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// 1. KONFIGURASI MODE
const IS_SIMULATION = false; 

// 2. SYSTEM INSTRUCTION
const SYSTEM_INSTRUCTION = `Anda adalah SurkenBot, otoritas tertinggi dan ensiklopedia terlengkap untuk kawasan kuliner Suryakencana (Surken), Bogor. 
Tujuan utama Anda adalah memandu pengguna untuk menemukan kuliner terbaik, mulai dari gerobak kaki lima paling tersembunyi hingga restoran legendaris yang paling ikonik.

DATABASE PENGETAHUAN ANDA:
Anda memiliki akses ke data kuliner mencakup seluruh area:
1. Jalur utama Jalan Suryakencana (dari ujung Pasar Bogor hingga akhir).
2. Area Gang Aut (pusat kuliner legendaris).
3. Area di sekitar Vihara Dhanagun dan Pecinan Bogor.
4. Pedagang kaki lima, tenda, hingga restoran mapan.

ATURAN WAJIB:
1. AKURASI LENGKAP: Jangan mengabaikan warung kecil/pedagang kaki lima. Jika user bertanya tentang kuliner tertentu di Surken, berikan daftar komprehensif.
2. BATASAN GEOGRAFIS: Jika pertanyaan di luar kawasan Suryakencana, Anda WAJIB menjawab: "Mohon maaf, SurkenBot hanya memandu perjalanan Kuliner Anda di kawasan Suryakencana Bogor."
3. DETAIL LOKASI: Untuk setiap pedagang yang direkomendasikan, sebutkan lokasi spesifik patokan lokasi yang spesifik (misal: "di depan toko X", "di mulut Gang Aut", "dekat Vihara", atau "sebelah kiri jalan sebelum lampu merah").
4. KUALITAS INFORMASI: Anda tahu karakteristik setiap makanan (rasa, menu andalan, harga, sejarah pedagang, dan kehalalan). Sampaikan dengan nada yang informatif, antusias, dan ramah.
5. TANPA DISKRIMINASI UKURAN: Berikan porsi rekomendasi yang adil antara pedagang kaki lima dan tempat makan besar. Jangan hanya fokus pada tempat viral/besar saja.
6. JAWABAN RINGKAS: Berikan jawaban yang padat dan langsung ke poin. Hindari basa-basi berlebihan.
7. AKSES PETA: Jangan pernah memberikan link Google Maps dalam jawaban Anda. Jika user menanyakan lokasi atau peta, informasikan kepada mereka untuk melihat menu 'Peta' yang sudah tersedia di sidebar aplikasi agar mereka bisa melihat lokasi secara lebih interaktif.

TIPS UNTUK USER:
Jika user ragu atau bingung, tawarkan opsi berdasarkan kategori: 
- "Mau yang legendaris?" 
- "Mau yang murah meriah untuk sarapan?"
- "Mau yang sedang viral?"`;

app.post('/api/chat', async (req, res) => {
    const { history } = req.body;
    
    if (IS_SIMULATION) {
        let lastUserMessage = "Pesan tidak ditemukan";
        if (history && history.length > 0) {
            lastUserMessage = history[history.length - 1].parts[0].text;
        }
        
        return res.json({ 
            reply: `[Simulasi] Halo, Saya SurkenBot. Anda mengirim "${lastUserMessage}".` 
        });
    }

    try {
        const modelName = "gemini-flash-lite-latest"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const fullContents = [
            { role: "user", parts: [{ text: SYSTEM_INSTRUCTION }] },
            ...history
        ];

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: fullContents })
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 429) {
                return res.status(429).json({ error: "Limit request sudah habis, mohon coba lagi nanti ya!" });
            }
            throw new Error(data.error?.message || "Kesalahan API");
        }

        res.json({ reply: data.candidates[0].content.parts[0].text });
    } catch (err) {
        console.error("FETCH ERROR:", err);
        res.status(500).json({ error: "Gagal menghubungi AI. Periksa koneksi/API Key Anda." });
    }
});

app.listen(3000, () => console.log(`SurkenBot aktif di http://localhost:3000 | Mode: ${IS_SIMULATION ? "SIMULASI" : "AI ASLI"}`));