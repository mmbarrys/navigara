const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const stream = require('stream');

const app = express();
const port = 5000;

// --- PERBAIKAN CORS NODE (Untuk Jaga-jaga) ---
const allowedOrigins = [
    'http://localhost:5173', // Dev frontend
    'https://random-name-xxxxx.netlify.app', // GANTI DENGAN URL NETLIFY ANDA
    'https://xxxxxxxxxxxx.ngrok-free.app' // GANTI DENGAN URL NGROK ANDA
];
app.use(cors({
  origin: function (origin, callback) {
    // Izinkan request tanpa origin (seperti Postman) atau dari origin yang diizinkan
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.error(`[Node Gateway - CORS] Blocked origin: ${origin}`); // Log origin yang diblokir
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}));
// ---------------------------------------------

const PYTHON_SERVICE_URL = 'http://localhost:5001';
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- AUTH (Tidak Berubah) ---
app.post('/api/login', bodyParser.json(), (req, res) => { /* ... (kode login) ... */ });

// --- API GATEWAY (Logging Error Lebih Detail) ---

async function forwardJsonToPython(req, res, pythonEndpoint) {
    console.log(`[Node Gateway - JSON] Menerima request ke ${req.originalUrl} dari Origin: ${req.headers.origin}`);
    try {
        const response = await axios.post(`${PYTHON_SERVICE_URL}${pythonEndpoint}`, req.body);
        res.json(response.data);
    } catch (error) {
        // --- LOGGING ERROR LEBIH DETAIL ---
        console.error(`[Node Gateway - JSON Error] Gagal meneruskan ke ${pythonEndpoint}:`);
        if (error.response) {
            // Error dari server Python (e.g., 400, 500)
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Data:`, error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            // Request dikirim tapi tidak ada respons (Python mati atau tidak terjangkau?)
            console.error(`  Request Error: Tidak ada respons dari ${PYTHON_SERVICE_URL}${pythonEndpoint}`);
            res.status(503).json({ message: 'Service Python tidak merespons', error: error.message });
        } else {
            // Error lain (konfigurasi Axios, dll)
            console.error('  Axios Config Error:', error.message);
            res.status(500).json({ message: 'Kesalahan internal saat meneruskan request', error: error.message });
        }
        // ------------------------------------
    }
}

async function forwardFileToPython(req, res, pythonEndpoint) {
    console.log(`[Node Gateway - FILE] Menerima request ke ${req.originalUrl} dari Origin: ${req.headers.origin}`);
    console.log(`[Node Gateway - FILE] File Fieldname: ${req.file?.fieldname}, Filename: ${req.file?.originalname}`);
    try {
        const form = new FormData();
        if (req.file) {
            const fileStream = new stream.PassThrough(); fileStream.end(req.file.buffer);
            form.append(req.file.fieldname, fileStream, { filename: req.file.originalname });
        } else { return res.status(400).json({ error: "File tidak terdeteksi oleh gateway" }); }
        for (const key in req.body) { form.append(key, req.body[key]); }

        const response = await axios.post(`${PYTHON_SERVICE_URL}${pythonEndpoint}`, form, { headers: { ...form.getHeaders() } });
        res.json(response.data);
    } catch (error) {
        // --- LOGGING ERROR LEBIH DETAIL (Sama seperti JSON) ---
        console.error(`[Node Gateway - FILE Error] Gagal meneruskan ke ${pythonEndpoint}:`);
         if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Data:`, error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            console.error(`  Request Error: Tidak ada respons dari ${PYTHON_SERVICE_URL}${pythonEndpoint}`);
            res.status(503).json({ message: 'Service Python tidak merespons (File)', error: error.message });
        } else {
            console.error('  Axios Config Error:', error.message);
            res.status(500).json({ message: 'Kesalahan internal saat meneruskan request (File)', error: error.message });
        }
        // ------------------------------------
    }
}

// --- ENDPOINTS (Tidak Berubah) ---
app.post('/api/lentera/generate-case', upload.single('file_cv'), (req, res) => forwardFileToPython(req, res, '/api/lentera/generate-case'));
app.post('/api/lentera/grade-final', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/lentera/grade-final'));
app.post('/api/selayar/osint-sentiment', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/selayar/osint-sentiment'));
app.post('/api/selayar/analyze-skp', upload.single('file_skp'), (req, res) => forwardFileToPython(req, res, '/api/selayar/analyze-skp'));
app.get('/api/nakhoda/get-graph', async (req, res) => {
    console.log(`[Node Gateway - GET] Menerima request ke ${req.originalUrl} dari Origin: ${req.headers.origin}`);
    try {
        const response = await axios.get(`${PYTHON_SERVICE_URL}/api/nakhoda/get-graph`);
        res.json(response.data);
    } catch (error) {
        // --- LOGGING ERROR LEBIH DETAIL (GET) ---
         console.error(`[Node Gateway - GET Error] Gagal meneruskan ke /api/nakhoda/get-graph:`);
         if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Data:`, error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            console.error(`  Request Error: Tidak ada respons dari ${PYTHON_SERVICE_URL}/api/nakhoda/get-graph`);
            res.status(503).json({ message: 'Service Python tidak merespons (GET)', error: error.message });
        } else {
            console.error('  Axios Config Error:', error.message);
            res.status(500).json({ message: 'Kesalahan internal saat meneruskan request (GET)', error: error.message });
        }
        // ------------------------------------
    }
});
app.post('/api/nakhoda/load-custom-graph', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/nakhoda/load-custom-graph'));
app.post('/api/nakhoda/simulate-move', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/nakhoda/simulate-move'));

app.listen(port, () => console.log(`[Node.js Gateway] Berjalan di http://localhost:${port}`));