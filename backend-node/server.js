const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const stream = require('stream');

const app = express();
const port = 5000;

const allowedOrigins = [
    'http://localhost:5173', // Dev frontend
    'https://navigara.netlify.app', // GANTI DENGAN URL NETLIFY ANDA
    'https://nonerroneously-unvoluptuous-alena.ngrok-free.dev' // GANTI DENGAN URL NGROK ANDA
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


const PYTHON_SERVICE_URL = 'http://localhost:5001';
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/login', bodyParser.json(), (req, res) => {
    const { username, password } = req.body;
    // --- GANTI CREDENTIAL DUMMY ---
    if (username === 'admin' && password === 'admin123') { 
    // ----------------------------
        console.log("[Node Gateway] Dummy login success for admin"); // Tambah log
        res.json({ 
            success: true, 
            token: 'dummy-token-12345', // Token tetap sama
            user: { name: 'Admin BKN' }
        });
    } else {
        console.log(`[Node Gateway] Dummy login failed for user: ${username}`); // Tambah log
        res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
});

async function forwardJsonToPython(req, res, pythonEndpoint) {
    try {
        const response = await axios.post(`${PYTHON_SERVICE_URL}${pythonEndpoint}`, req.body);
        res.json(response.data);
    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data || { message: 'Error Python Service (JSON)', error: error.message };
        res.status(status).json(message);
    }
}

async function forwardFileToPython(req, res, pythonEndpoint) {
    try {
        const form = new FormData();
        if (req.file) {
            const fileStream = new stream.PassThrough();
            fileStream.end(req.file.buffer);
            form.append(req.file.fieldname, fileStream, { filename: req.file.originalname });
        } else {
            return res.status(400).json({ error: "File tidak terdeteksi oleh gateway" });
        }
        for (const key in req.body) {
            form.append(key, req.body[key]);
        }
        const response = await axios.post(`${PYTHON_SERVICE_URL}${pythonEndpoint}`, form, {
            headers: { ...form.getHeaders() }
        });
        res.json(response.data);
    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data || { message: 'Error Python Service (File)', error: error.message };
        res.status(status).json(message);
    }
}

// === LENTERA (ENDPOINT BARU) ===
app.post('/api/lentera/generate-case', upload.single('file_cv'), (req, res) => forwardFileToPython(req, res, '/api/lentera/generate-case'));
app.post('/api/lentera/grade-final', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/lentera/grade-final'));

// === SELAYAR (ENDPOINT BARU) ===
app.post('/api/selayar/osint-sentiment', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/selayar/osint-sentiment'));
app.post('/api/selayar/analyze-skp', upload.single('file_skp'), (req, res) => forwardFileToPython(req, res, '/api/selayar/analyze-skp'));

// === NAKHODA (SAMA) ===
app.get('/api/nakhoda/get-graph', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_SERVICE_URL}/api/nakhoda/get-graph`);
        res.json(response.data);
    } catch (error) { res.status(500).json({ message: 'Error Python Service (GET)', error: error.message }); }
});
app.post('/api/nakhoda/load-custom-graph', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/nakhoda/load-custom-graph'));
app.post('/api/nakhoda/simulate-move', bodyParser.json(), (req, res) => forwardJsonToPython(req, res, '/api/nakhoda/simulate-move'));

app.listen(port, () => console.log(`[Node.js Gateway] Berjalan di http://localhost:${port}`));