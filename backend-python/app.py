from flask import Flask, jsonify, request
from flask_cors import CORS
import networkx as nx
import json
import os
import re # Import modul regular expression
from dotenv import load_dotenv
import logging
from logging.handlers import RotatingFileHandler
import google.generativeai as genai
import requests
import fitz  # PyMuPDF
from werkzeug.utils import secure_filename
from googleapiclient.discovery import build # Google Search

# --- Konfigurasi Awal ---
load_dotenv()
app = Flask(__name__)
CORS(app) # Biarkan global untuk kemudahan development
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Konfigurasi Logging ---
log_formatter = logging.Formatter('%(asctime)s %(levelname)s %(funcName)s(%(lineno)d) %(message)s')
log_file = 'navigara_backend.log'
file_handler = RotatingFileHandler(log_file, maxBytes=1024*1024*5, backupCount=2)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.INFO)
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.INFO)
app.logger.handlers.clear()
app.logger.addHandler(file_handler)
app.logger.addHandler(console_handler)
app.logger.setLevel(logging.INFO)
app.logger.info("Server NAVIGARA (Python) v2.2 (Enhanced Profile) Dimulai...")

# --- Konfigurasi Klien API ---
GEMINI_KEY = os.getenv('GEMINI_API_KEY')
BYTEPLUS_KEY = os.getenv('BYTEPLUS_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
GOOGLE_CSE_ID = os.getenv('GOOGLE_CSE_ID')
GEMINI_MODEL_NAME = "gemini-2.5-flash"
BYTEPLUS_MODEL_NAME = "seed-1-6-250615"
BYTEPLUS_API_ENDPOINT = "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions"

# Klien Gemini
if GEMINI_KEY:
    try:
        genai.configure(api_key=GEMINI_KEY)
        gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        app.logger.info(f"Klien API Gemini dikonfigurasi. Model: {GEMINI_MODEL_NAME}")
    except Exception as e: gemini_model = None; app.logger.error(f"Gagal konfigurasi Gemini: {str(e)}")
else: gemini_model = None; app.logger.warning("GEMINI_API_KEY tidak ditemukan.")

# Klien Google Search
if GOOGLE_API_KEY and GOOGLE_CSE_ID:
    try:
        google_search_service = build("customsearch", "v1", developerKey=GOOGLE_API_KEY)
        app.logger.info("Klien Google Custom Search berhasil dikonfigurasi.")
    except Exception as e: google_search_service = None; app.logger.error(f"Gagal konfigurasi Google Search: {str(e)}")
else: google_search_service = None; app.logger.warning("GOOGLE keys tidak ditemukan. OSINT dibatasi.")

if not BYTEPLUS_KEY: app.logger.warning("BYTEPLUS_API_KEY tidak ditemukan.")

# --- Helper: Ekstraksi Teks File ---
def extract_text_from_file(file_path):
    try:
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path); text = "".join(page.get_text() for page in doc); doc.close(); return text
        elif file_path.lower().endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as f: return f.read()
        return None
    except Exception as e: app.logger.error(f"Gagal ekstrak file {file_path}: {str(e)}"); return None

# --- Helper: Fungsi Panggilan AI ---
def call_gemini_api(prompt):
    if not gemini_model: return "Error: Klien API Gemini tidak terkonfigurasi."
    try: return gemini_model.generate_content(prompt).text
    except Exception as e: app.logger.error(f"Error API Gemini: {str(e)}"); return f"Error API Gemini: {str(e)}"

def call_byteplus_api(prompt, system_prompt="Anda asisten AI."):
    if not BYTEPLUS_KEY: return "Error: Klien API Byteplus tidak terkonfigurasi."
    headers = {"Authorization": f"Bearer {BYTEPLUS_KEY}", "Content-Type": "application/json"}
    payload = {"model": BYTEPLUS_MODEL_NAME, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]}
    try:
        response = requests.post(BYTEPLUS_API_ENDPOINT, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except requests.exceptions.ReadTimeout: return "Error: API Byteplus Timeout (60s)."
    except Exception as e: app.logger.error(f"Error API Byteplus: {str(e)}"); return f"Error API Byteplus: {str(e)}"

# --- Helper: OSINT Engine (Google Search) ---
def run_osint_analysis(query):
    app.logger.info(f"OSINT Engine: Google Search '{query}'")
    articles = []
    if not google_search_service:
        articles.append({"source": "Sistem", "title": "Google Search API Error", "url": "#", "snippet": "API Key/CSE ID tidak valid."})
        return articles
    try:
        result = google_search_service.cse().list(q=query, cx=GOOGLE_CSE_ID, num=3, gl='id').execute() # Ambil 3 hasil saja
        if 'items' in result:
            for item in result['items']:
                articles.append({"source": item.get('displayLink','N/A'), "title": item.get('title','N/A'), "url": item.get('link','#'), "snippet": item.get('snippet','')})
        else: articles.append({"source": "Google", "title": "Tidak ada hasil", "url": "#", "snippet": ""})
    except Exception as e:
        app.logger.error(f"Error Google Search API: {str(e)}")
        err_msg = "Kuota Habis?" if "quota" in str(e).lower() else str(e)
        articles.append({"source": "Google", "title": "Error API", "url": "#", "snippet": err_msg})
    return articles

# --- Helper: Parsing Skor (Lebih Robust) ---
def parse_score(text, keyword, default=50):
    """Mencari keyword dalam teks dan mengekstrak angka setelahnya."""
    try:
        # Cari pola seperti "Keyword: [angka]" atau "Keyword [angka]" atau "[angka] / 100"
        match = re.search(rf"{keyword}\s*[:\-]*\s*(\d+)", text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        # Coba cari pola skor / 100 jika keyword ada di baris yg sama
        match_fraction = re.search(rf".*{keyword}.*?(\d+)\s*/\s*100", text, re.IGNORECASE | re.DOTALL)
        if match_fraction:
            return int(match_fraction.group(1))
        return default
    except:
        return default

# --- MODUL 1: LENTERA ---
@app.route('/api/lentera/generate-case', methods=['POST'])
def lentera_generate_case():
    # ... (kode sama seperti V2) ...
    if 'file_cv' not in request.files: return jsonify({"error": "File CV tidak terdeteksi"}), 400
    file_cv, provider, jabatan = request.files['file_cv'], request.form.get('provider', 'gemini'), request.form.get('jabatan', 'Analis Kebijakan')
    filename = secure_filename(file_cv.filename); file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename); file_cv.save(file_path)
    app.logger.info(f"LENTERA (Tahap 1): Generate Case. File: {filename}, Jabatan: {jabatan}")
    cv_text = extract_text_from_file(file_path); os.remove(file_path)
    if not cv_text: return jsonify({"error": "Gagal membaca teks CV"}), 500
    prompt = f"Anda Asesor AI BKN...\nDATA KANDIDAT:\n- Jabatan: {jabatan}\n- CV: {cv_text[:2000]}\nTUGAS: Buat 1 soal studi kasus relevan...\n**Skenario:**\n[Skenario]\n\n**Pertanyaan (3 poin):**\n1. [P1]\n2. [P2]\n3. [P3]"
    if provider == 'gemini': result = call_gemini_api(prompt)
    else: result = call_byteplus_api(prompt, "Anda Asesor AI BKN pembuat soal.")
    return jsonify({"case_study": result, "cv_text_cache": cv_text})

@app.route('/api/lentera/grade-final', methods=['POST'])
def lentera_grade_final():
    # --- PROMPT & PARSING BARU ---
    data = request.json
    provider, jabatan = data.get('provider', 'gemini'), data.get('jabatan', 'Analis Kebijakan')
    cv_text, case_study, answer = data.get('cv_text_cache', ''), data.get('case_study', ''), data.get('answer', '')
    app.logger.info(f"LENTERA (Tahap 2): Grade Final. Provider: {provider}")

    nama_kandidat = "Kandidat"
    match_nama = re.search(r"(?:nama|name)\s*[:\-]*\s*(.+)", cv_text, re.IGNORECASE)
    if match_nama: nama_kandidat = match_nama.group(1).strip().splitlines()[0] # Ambil baris pertama nama
        
    osint_results = run_osint_analysis(f'"{nama_kandidat}" ASN OR PNS OR BKN')
    osint_summary = "\n".join([f"- [{res['source']}]({res['url']}): {res['snippet'][:100]}..." for res in osint_results])

    prompt = f"""
    Anda adalah AI Grader BKN yang objektif dan teliti.
    Tugas Anda adalah membuat **Profil Potensi LENTERA** yang komprehensif dan terstruktur.

    --- DATA KANDIDAT ---
    **Jabatan yang Dituju:** {jabatan}
    **Nama (dari CV):** {nama_kandidat}
    **Ringkasan CV:** {cv_text[:2000]} 
    --- AKHIR CV ---

    --- DATA ASESMEN ---
    **Soal Studi Kasus:**
    {case_study}
    --- AKHIR SOAL ---
    **Jawaban Kandidat:**
    {answer}
    --- AKHIR JAWABAN ---

    --- DATA OSINT (Jejak Digital) ---
    {osint_summary}
    --- AKHIR OSINT ---

    INSTRUKSI PEMBUATAN PROFIL (WAJIB DIIKUTI):
    Buatlah profil dalam format Markdown berikut. Berikan analisis **objektif** dan **ringkas** di setiap bagian. Berikan **skor numerik** yang jelas.

    **================ PROFIL POTENSI LENTERA ================**

    **Nama Kandidat:** {nama_kandidat}
    **Jabatan Dituju:** {jabatan}

    **1. Analisis Kualifikasi (CV vs Jabatan):**
    * **Kesesuaian Pendidikan/Pengalaman:** [Analisis ringkas kesesuaian latar belakang dengan jabatan]
    * **Keterampilan Relevan (Terdeteksi):** [Sebutkan 1-3 skill kunci dari CV yang cocok]
    * **Potensi Pengembangan:** [Area potensi dari CV yang bisa dikembangkan untuk jabatan ini]

    **2. Analisis Studi Kasus (Jawaban vs Soal):**
    * **Pemahaman Masalah:** [Analisis apakah kandidat memahami inti masalah di soal]
    * **Logika & Struktur Jawaban:** [Analisis alur berpikir dan keruntutan jawaban]
    * **Solusi & Problem-Solving:** [Analisis kualitas solusi yang ditawarkan]
    * **Indikasi Integritas/Etika (jika relevan):** [Apakah ada indikasi positif/negatif dari jawaban?]

    **3. Analisis Jejak Digital (OSINT):**
    * **Temuan Signifikan:** [Ringkasan temuan OSINT. Apakah ada informasi relevan (positif/negatif/netral)?]
    * **Konsistensi dengan CV:** [Apakah temuan OSINT mendukung/bertentangan dengan CV?]

    **4. SKOR POTENSI (Estimasi AI):**
    * **Skor Kualifikasi (CV):** [Angka 1-100] / 100
    * **Skor Nalar & Solusi (Jawaban):** [Angka 1-100] / 100
    * **SKOR TOTAL POTENSI:** [HITUNG RATA-RATA DUA SKOR DI ATAS] / 100 

    **5. REKOMENDASI KELAYAKAN:**
    [Pilih salah satu: **Sangat Direkomendasikan** / **Direkomendasikan** / **Dipertimbangkan (dengan catatan)** / **Butuh Pengembangan Signifikan**]
    * **Justifikasi Singkat:** [1 kalimat alasan rekomendasi Anda]

    **6. Rekomendasi Pembelajaran (Jika < Direkomendasikan):**
    [Jika rekomendasi BUKAN 'Sangat Direkomendasikan' atau 'Direkomendasikan', berikan 1-2 link relevan di bawah ini. Jika sudah direkomendasikan, tulis "Tidak diperlukan."]
    * [Contoh: Untuk mempertajam analisis kebijakan: https://asn.futureskills.id/fs]
    * [Contoh: Pelajari standar SNI terkait: https://elearning.bsn.go.id/]

    **================ AKHIR PROFIL ================**
    """
    
    if provider == 'gemini': result_text = call_gemini_api(prompt)
    else: result_text = call_byteplus_api(prompt, "Anda adalah AI Grader BKN yang objektif dan teliti.")
    
    # Parsing Skor Total Potensi (Lebih Robust)
    skor_potensi_final = parse_score(result_text, "SKOR TOTAL POTENSI")
        
    return jsonify({
        "grading_result": result_text, 
        "skor_potensi": skor_potensi_final 
    })

# --- MODUL 2: SELAYAR ---
@app.route('/api/selayar/osint-sentiment', methods=['POST'])
def selayar_osint_sentiment():
    # ... (kode sama seperti V2.1) ...
    data = request.json; program_kerja, provider = data.get('program', 'Pelayanan Publik'), data.get('provider', 'byteplus')
    app.logger.info(f"SELAYAR (OSINT): Dipicu. Program: {program_kerja}, Provider: {provider}")
    osint_articles = run_osint_analysis(program_kerja)
    if not osint_articles: return jsonify({"error": "Gagal menjalankan OSINT"}), 500
    osint_snippets = "\n".join([f"- {a['snippet']}" for a in osint_articles if a['snippet']])
    prompt = f"Anda AI Analis Sentimen Publik...\nOSINT Snippets tentang \"{program_kerja}\":\n---\n{osint_snippets}\n---\nTugas: Analisis sentimen (Positif/Negatif/Netral) & 1 kalimat ringkasan."
    if provider == 'gemini': sentiment_summary = call_gemini_api(prompt)
    else: sentiment_summary = call_byteplus_api(prompt, "Anda adalah analis sentimen publik.")
    return jsonify({"program": program_kerja, "sentiment_summary": sentiment_summary, "articles": osint_articles})

@app.route('/api/selayar/analyze-skp', methods=['POST'])
def selayar_analyze_skp():
    # --- PROMPT & PARSING BARU ---
    if 'file_skp' not in request.files: return jsonify({"error": "File SKP tidak terdeteksi"}), 400
    file_skp, provider = request.files['file_skp'], request.form.get('provider', 'gemini')
    filename = secure_filename(file_skp.filename); file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename); file_skp.save(file_path)
    app.logger.info(f"SELAYAR (SKP): Analyze Artifact. File: {filename}")
    doc_text = extract_text_from_file(file_path); os.remove(file_path)
    if not doc_text: return jsonify({"error": "Gagal membaca teks SKP"}), 500

    prompt = f"""
    Anda adalah AI Analis Kinerja ASN yang objektif dan kritis.
    Berdasarkan dokumen SKP/Laporan Kinerja berikut:
    ---
    {doc_text[:9000]}
    ---
    TUGAS: Analisis dan berikan poin-poin berikut (gunakan **bold** dan list):
    
    **1. Ringkasan Kontribusi & Aktivitas Utama:**
    * [Kontribusi/Aktivitas 1]
    * [Kontribusi/Aktivitas 2]
    * [Kontribusi/Aktivitas 3 (jika ada)]
    
    **2. Analisis Pencapaian Target Kinerja:**
    * [Analisis singkat apakah target utama tercapai/melebihi/tidak tercapai berdasarkan data di dokumen]

    **3. SKOR KINERJA (Estimasi AI):**
    * [Angka 1-100] / 100 (berdasarkan bukti pencapaian & kontribusi)

    **4. Saran Peningkatan Konstruktif:**
    * [Berikan 1 saran spesifik dan actionable untuk pengembangan pegawai]
    """
    
    if provider == 'gemini': result_text = call_gemini_api(prompt)
    else: result_text = call_byteplus_api(prompt, "Anda adalah AI Analis Kinerja ASN yang objektif.")
    
    # Parsing Skor Kinerja (Lebih Robust)
    skor_kinerja_final = parse_score(result_text, "SKOR KINERJA")
        
    return jsonify({
        "artifact_analysis": result_text, 
        "skor_kinerja": skor_kinerja_final 
    })

# --- MODUL 3: NAKHODA (Tidak Berubah dari V2.1) ---
# ... (Semua fungsi NAKHODA: analyze_graph, get_graph, load_custom_graph, simulate_move tetap sama persis seperti sebelumnya) ...
# ... (Pastikan Anda menyalin SEMUA fungsi Nakhoda dari app.py sebelumnya ke sini) ...
def analyze_graph(pegawai_list, kolaborasi_list):
    G = nx.Graph()
    for p in pegawai_list:
        potensi = p.get('skor_potensi', 50); kinerja = p.get('skor_kinerja', 50)
        combined_score = (kinerja * 0.6) + (potensi * 0.4)
        G.add_node(p['id'], label=p.get('nama','N/A'), unit=p.get('unit','N/A'), jabatan=p.get('jabatan','N/A'), score=combined_score)
    for k in kolaborasi_list:
        if G.has_node(k.get('source')) and G.has_node(k.get('target')):
            G.add_edge(k['source'], k['target'], label=k.get('project',''))
    if not G.nodes: return {"nodes": [], "edges": [], "metrics": {"total_pegawai": 0, "total_kolaborasi": 0, "avg_effectiveness": 0, "num_silos": 0}}
    centrality = nx.degree_centrality(G)
    num_silos = nx.number_connected_components(G)
    total_effectiveness_score = sum((G.nodes[n].get('score', 50) * (1 + centrality.get(n, 0))) for n in G.nodes())
    nodes_for_reactflow = []
    for node in G.nodes(data=True):
        node_id, node_data = node; node_score = node_data.get('score', 50)
        bg = '#90EE90' if node_score > 80 else ('#FFD700' if node_score > 60 else '#F08080')
        nodes_for_reactflow.append({"id": node_id, "position": {"x": 0, "y": 0},"data": {"label": f"{node_data.get('label','N/A')} ({node_data.get('unit','N/A')})\nSkor: {node_score:.0f}"},"style": { "background": bg, "border": "1px solid #333", "whiteSpace": "pre-line", "textAlign": "center"}})
    edges_for_reactflow = [{"id": f"e-{e[0]}-{e[1]}", "source": e[0], "target": e[1], "label": e[2].get('label', ''), "animated": True} for e in G.edges(data=True)]
    metrics = {"total_pegawai": G.number_of_nodes(), "total_kolaborasi": G.number_of_edges(), "avg_effectiveness": (total_effectiveness_score / G.number_of_nodes()) if G.number_of_nodes() > 0 else 0, "num_silos": num_silos}
    return {"nodes": nodes_for_reactflow, "edges": edges_for_reactflow, "metrics": metrics}


@app.route('/api/nakhoda/get-graph', methods=['GET'])
def get_graph():
    app.logger.info("Modul NAKHODA: Mengambil graf awal (dummy_data_v2.json).")
    try:
        with open('dummy_data_v2.json', 'r') as f: data = json.load(f)
    except FileNotFoundError:
        app.logger.warning("dummy_data_v2.json tidak ada! Membuat baru...")
        new_dummy_data={"pegawai": [{"id": "1", "nama": "Anya", "unit": "A", "skor_potensi": 90, "skor_kinerja": 95}, {"id": "2", "nama": "Budi", "unit": "A", "skor_potensi": 95, "skor_kinerja": 70}, {"id": "3", "nama": "Citra", "unit": "SDM", "skor_potensi": 80, "skor_kinerja": 85}], "kolaborasi": [{"source": "1", "target": "2"}, {"source": "1", "target": "3"}, {"source": "2", "target": "3"}]}
        with open('dummy_data_v2.json', 'w') as f: json.dump(new_dummy_data, f, indent=2)
        data = new_dummy_data
    result = analyze_graph(data['pegawai'], data['kolaborasi'])
    return jsonify(result)

@app.route('/api/nakhoda/load-custom-graph', methods=['POST'])
def load_custom_graph():
    data = request.json
    pegawai_json_text, kolaborasi_json_text = data.get('pegawaiData'), data.get('kolaborasiData')
    app.logger.info("Modul NAKHODA: Menerima data graf kustom.")
    try:
        pegawai_list, kolaborasi_list = json.loads(pegawai_json_text), json.loads(kolaborasi_json_text)
        result = analyze_graph(pegawai_list, kolaborasi_list)
        return jsonify(result)
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/api/nakhoda/simulate-move', methods=['POST'])
def simulate_move():
    try:
        sim_data = request.json
        pegawai_id, target_unit = sim_data.get('pegawaiId'), sim_data.get('targetUnit')
        pegawai_list, kolaborasi_list = sim_data.get('pegawaiList', []), sim_data.get('kolaborasiList', [])
        app.logger.info(f"Modul NAKHODA: Simulasi pemindahan {pegawai_id} ke {target_unit}")
        if not pegawai_id or not target_unit: return jsonify({"error": "Data simulasi tidak lengkap"}), 400
        if not pegawai_list:
             with open('dummy_data_v2.json', 'r') as f: data = json.load(f)
             pegawai_list, kolaborasi_list = data['pegawai'], data['kolaborasi']
        sim_pegawai_list = [p.copy() if p['id'] != pegawai_id else {**p, 'unit': target_unit} for p in pegawai_list]
        sim_result = analyze_graph(sim_pegawai_list, kolaborasi_list)
        original_result = analyze_graph(pegawai_list, kolaborasi_list)
        original_score, new_score = original_result['metrics']['avg_effectiveness'], sim_result['metrics']['avg_effectiveness']
        impact = new_score - original_score
        impact_report = (f"Laporan Dampak Simulasi:\n- Pegawai (ID: {pegawai_id}) dipindah ke Unit '{target_unit}'.\n\n**Skor Efektivitas Tim (Baru): {new_score:.2f}**\n**Skor Efektivitas Tim (Lama): {original_score:.2f}**\n**Dampak Perubahan: {impact:+.2f} Poin**\n\n- Jumlah Silo Organisasi: {sim_result['metrics']['num_silos']} (Sebelum: {original_result['metrics']['num_silos']}")
        sim_result['report'] = impact_report
        app.logger.info("Simulasi berhasil.")
        return jsonify(sim_result)
    except Exception as e: return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)