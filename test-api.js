require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        console.log("Mencoba mengambil daftar model...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("BERHASIL! Model yang tersedia:");
            data.models.forEach(m => console.log("- " + m.name));
        } else {
            console.log("Gagal mendapatkan daftar model:", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Error koneksi:", err.message);
    }
}
test();