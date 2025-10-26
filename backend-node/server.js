const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const stream = require('stream');

const app = express();
const port = 5000;

// Konfigurasi CORS (Ganti URL sesuai kebutuhan)
const allowedOrigins = [
    'http://localhost:5173', // Dev frontend
    'https://navigara.netlify.app', // GANTI DENGAN URL NETLIFY ANDA
    // Tambahkan URL Ngrok jika masih perlu testing langsung ke Ngrok
    // 'https://nonerroneously-unvoluptuous-alena.ngrok-free.dev' // CONTOH
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.error(`[Node Gateway - CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}));

const PYTHON_SERVICE_URL = 'http://localhost:5001';
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- AUTH ---
app.post('/api/login', bodyParser.json(), (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        console.log("[Node Gateway] Dummy login success for admin");
        res.json({ success: true, token: 'dummy-token-12345', user: { name: 'Admin BKN' } });
    } else {
        console.log(`[Node Gateway] Dummy login failed for user: ${username}`);
        res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
});

// --- API GATEWAY ---

// Helper JSON
async function forwardJsonToPython(req, res, pythonEndpoint) {
    console.log(`[Node Gateway - JSON] Menerima request ke ${req.originalUrl} dari Origin: ${req.headers.origin}`);
    try {
        const response = await axios.post(`${PYTHON_SERVICE_URL}${pythonEndpoint}`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error(`[Node Gateway - JSON Error] Gagal meneruskan ke ${pythonEndpoint}:`);
        if (error.response) { console.error(`  Status: ${error.response.status}`); console.error(`  Data:`, error.response.data); res.status(error.response.status).json(error.response.data); }
        else if (error.request) { console.error(`  Request Error: No response from ${PYTHON_SERVICE_URL}${pythonEndpoint}`); res.status(503).json({ message: 'Service Python tidak merespons', error: error.message }); }
        else { console.error('  Axios Config Error:', error.message); res.status(500).json({ message: 'Kesalahan internal saat meneruskan request', error: error.message }); }
    }
}

// Helper File/FormData
async function forwardFileToPython(req, res, pythonEndpoint) {
    console.log(`[Node Gateway - FILE/FORM] Request ke ${req.originalUrl} from ${req.headers.origin}`);
    try {
        const form = new FormData();
        let answerTextFromBody = ''; // Tampung answer_text

        // 1. Handle file jika ada
        if (req.file) {
            console.log(`[Node Gateway - FILE/FORM] Attaching file: ${req.file.originalname} (field: ${req.file.fieldname})`);
            const fileStream = new stream.PassThrough();
            fileStream.end(req.file.buffer);
            form.append(req.file.fieldname, fileStream, { filename: req.file.originalname });
        } else {
            console.log(`[Node Gateway - FILE/FORM] No file attached.`);
        }

        // 2. Handle text fields dari req.body
        console.log('[Node Gateway - FILE/FORM] Attaching body fields:', req.body);
        let answerTextExistsInBody = false; // Flag untuk cek answer_text
        for (const key in req.body) {
            if (Object.hasOwnProperty.call(req.body, key)) {
                 form.append(key, req.body[key]);
            }
        }
        console.log(`[Node Gateway - FILE/FORM] Forwarding FormData to ${PYTHON_SERVICE_URL}${pythonEndpoint}`);
        const response = await axios.post(`${PYTHON_SERVICE_URL}${pythonEndpoint}`, form, {
            headers: { ...form.getHeaders() }
        });
        res.json(response.data);
    } catch (error) {
        console.error(`[Node Gateway - FILE/FORM Error] Gagal meneruskan ke ${pythonEndpoint}:`);
        if (error.response) { console.error(`  Status: ${error.response.status}`); console.error(`  Data:`, error.response.data); res.status(error.response.status).json(error.response.data); }
        else if (error.request) { console.error(`  Request Error: No response from ${PYTHON_SERVICE_URL}${pythonEndpoint}`); res.status(503).json({ message: 'Service Python tidak merespons (File)', error: error.message }); }
        else { console.error('  Axios Config Error:', error.message); res.status(500).json({ message: 'Kesalahan internal saat meneruskan request (File)', error: error.message }); }
    }
}

// --- ENDPOINTS ---

// MODUL 1: LENTERA
app.post('/api/lentera/generate-case', upload.single('file_cv'), (req, res) => forwardFileToPython(req, res, '/api/lentera/generate-case'));
// Hapus definisi duplikat, pastikan HANYA ini untuk grade-final
app.post('/api/lentera/grade-final', upload.single('file_answer'), (req, res) => forwardFileToPython(req, res, '/api/lentera/grade-final'));
app.post('/api/lentera/export-pdf', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/lentera/export-pdf'));


// MODUL 2: SELAYAR
app.post('/api/selayar/osint-sentiment', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/selayar/osint-sentiment'));
app.post('/api/selayar/analyze-skp', upload.single('file_skp'), (req, res) => forwardFileToPython(req, res, '/api/selayar/analyze-skp'));
app.post('/api/selayar/export-pdf', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/selayar/export-pdf'));


// MODUL 3: NAKHODA
app.get('/api/nakhoda/get-graph', async (req, res) => {
    console.log(`[Node Gateway - GET] Request ke ${req.originalUrl} from ${req.headers.origin}`);
    try {
        const response = await axios.get(`${PYTHON_SERVICE_URL}/api/nakhoda/get-graph`);
        res.json(response.data);
    } catch (error) { /* ... logging error GET ... */ }
});
app.post('/api/nakhoda/load-custom-graph', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/nakhoda/load-custom-graph'));
app.post('/api/nakhoda/simulate-move', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/nakhoda/simulate-move'));


// --- Endpoint History ---
app.get('/api/history', async (req, res) => {
    console.log(`[Node Gateway - GET] Menerima request ke ${req.originalUrl} dari Origin: ${req.headers.origin}`);
    try {
        const response = await axios.get(`${PYTHON_SERVICE_URL}/api/history`);
        res.json(response.data);
    } catch (error) { 
        // ... (logging error GET sama seperti get-graph) ... 
        console.error(`[Node Gateway - GET Error] Gagal meneruskan ke /api/history:`);
        // ... (detail error) ...
    }
});
app.delete('/api/history/:log_id', async (req, res) => {
    const logId = req.params.log_id;
    console.log(`[Node Gateway - DELETE] Menerima request ke ${req.originalUrl} dari Origin: ${req.headers.origin}`);
    try {
        const response = await axios.delete(`${PYTHON_SERVICE_URL}/api/history/${logId}`);
        res.json(response.data);
    } catch (error) {
        // ... (logging error detail, mirip POST JSON) ...
         console.error(`[Node Gateway - DELETE Error] Gagal meneruskan ke /api/history/${logId}:`);
         // ... (detail error) ...
    }
});


app.listen(port, () => console.log(`[Node.js Gateway] Berjalan di http://localhost:${port}`));