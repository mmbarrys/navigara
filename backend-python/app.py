from flask import Flask, jsonify, request, send_file # <-- Tambah send_file
from flask_cors import CORS
import networkx as nx
import json
import os
import re 
from dotenv import load_dotenv
import logging
from logging.handlers import RotatingFileHandler
import google.generativeai as genai
import requests
import fitz  # PyMuPDF
from werkzeug.utils import secure_filename
from googleapiclient.discovery import build # Google Search
import markdown # <-- IMPORT BARU
from xhtml2pdf import pisa # <-- IMPORT BARU
from io import BytesIO # <-- IMPORT BARU

# --- Konfigurasi Awal ---
load_dotenv(); app = Flask(__name__); CORS(app)
UPLOAD_FOLDER = 'uploads'; os.makedirs(UPLOAD_FOLDER, exist_ok=True); app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Konfigurasi Logging ---
# ... (Kode logging sama seperti V2.1) ...
log_formatter = logging.Formatter('%(asctime)s %(levelname)s %(funcName)s(%(lineno)d) %(message)s'); log_file = 'navigara_backend.log'
file_handler = RotatingFileHandler(log_file, maxBytes=1024*1024*5, backupCount=2); file_handler.setFormatter(log_formatter); file_handler.setLevel(logging.INFO)
console_handler = logging.StreamHandler(); console_handler.setFormatter(log_formatter); console_handler.setLevel(logging.INFO)
app.logger.handlers.clear(); app.logger.addHandler(file_handler); app.logger.addHandler(console_handler); app.logger.setLevel(logging.INFO)
app.logger.info("Server NAVIGARA (Python) v3.0 (Profile Cards & PDF) Dimulai...")

# --- Konfigurasi Klien API ---
GEMINI_KEY = os.getenv('GEMINI_API_KEY')
BYTEPLUS_KEY = os.getenv('BYTEPLUS_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
GOOGLE_CSE_ID = os.getenv('GOOGLE_CSE_ID')
GEMINI_MODEL_NAME = "gemini-1.5-flash"
BYTEPLUS_MODEL_NAME = "seed-1-6-250615"
BYTEPLUS_API_ENDPOINT = "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions"

# Klien Gemini & Google Search (Sama seperti V2.1)
# ... (Kode inisialisasi gemini_model & google_search_service sama) ...
if GEMINI_KEY:
    try: genai.configure(api_key=GEMINI_KEY); gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME); app.logger.info(f"Gemini OK: {GEMINI_MODEL_NAME}")
    except Exception as e: gemini_model = None; app.logger.error(f"Gemini Fail: {str(e)}")
else: gemini_model = None; app.logger.warning("GEMINI_API_KEY missing.")
if GOOGLE_API_KEY and GOOGLE_CSE_ID:
    try: google_search_service = build("customsearch", "v1", developerKey=GOOGLE_API_KEY); app.logger.info("Google Search OK.")
    except Exception as e: google_search_service = None; app.logger.error(f"Google Search Fail: {str(e)}")
else: google_search_service = None; app.logger.warning("GOOGLE keys missing.")
if not BYTEPLUS_KEY: app.logger.warning("BYTEPLUS_API_KEY missing.")

# --- Helper: Ekstraksi Teks File (Sama) ---
def extract_text_from_file(file_path):
    try:
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path); text = "".join(page.get_text() for page in doc); doc.close(); return text
        elif file_path.lower().endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as f: return f.read()
        return None
    except Exception as e: app.logger.error(f"Gagal ekstrak file {file_path}: {str(e)}"); return None

# --- Helper: Fungsi Panggilan AI (Sama) ---
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

# --- Helper: OSINT Engine (Google Search - Sama) ---
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

# --- Helper: Parsing Skor (Sama) ---
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

# --- Helper BARU: Generate PDF ---
def generate_pdf_from_markdown(markdown_text, filename="profile_lentera.pdf"):
    """Mengubah teks Markdown menjadi file PDF."""
    try:
        html_content = markdown.markdown(markdown_text, extensions=['extra', 'nl2br'])
        
        # Style CSS sederhana untuk PDF
        css = """
        @page { size: A4; margin: 1.5cm; }
        body { font-family: sans-serif; font-size: 10pt; color: #333; }
        h1, h2, h3, h4 { color: #003366; } /* Warna BKN */
        h1 { font-size: 18pt; text-align: center; margin-bottom: 20px; }
        h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 15px; }
        strong { color: #00509E; } /* Biru lebih muda */
        ul, ol { padding-left: 20px; }
        li { margin-bottom: 5px; }
        pre { background-color: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; }
        a { color: #3b82f6; text-decoration: none; }
        .score-section { margin-top: 10px; padding-left: 10px; }
        .score-label { font-weight: bold; }
        .score-value { color: #00509E; font-size: 11pt; }
        .recommendation { margin-top: 15px; font-weight: bold; padding: 5px; border-radius: 3px; }
        .recommendation.sangat { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .recommendation.direkomendasikan { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .recommendation.dipertimbangkan { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
        .recommendation.butuh { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        """

        result = BytesIO()
        pdf = pisa.CreatePDF(
            BytesIO(f"<html><head><style>{css}</style></head><body><h1>Profil Potensi Lentera</h1>{html_content}</body></html>".encode('utf-8')),
            dest=result
        )
        
        if pdf.err:
            app.logger.error(f"Error xhtml2pdf: {pdf.err}")
            return None
            
        result.seek(0)
        return result
    except Exception as e:
        app.logger.error(f"Error generate_pdf_from_markdown: {str(e)}")
        return None

# --- MODUL 1: LENTERA ---

@app.route('/api/lentera/generate-case', methods=['POST'])
def lentera_generate_case():
    # --- LOGIKA BARU: CV OPSIONAL ---
    provider = request.form.get('provider', 'gemini')
    jabatan = request.form.get('jabatan', 'Analis Kebijakan')
    cv_text = "" # Default kosong
    filename = "N/A"

    # Cek jika ada file CV
    if 'file_cv' in request.files:
        file_cv = request.files['file_cv']
        if file_cv.filename != '':
            filename = secure_filename(file_cv.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file_cv.save(file_path)
            cv_text_extracted = extract_text_from_file(file_path)
            os.remove(file_path)
            if cv_text_extracted:
                cv_text = cv_text_extracted
            else:
                app.logger.warning("Gagal ekstrak CV, generate case tanpa CV.")
    
    app.logger.info(f"LENTERA (Tahap 1): Generate Case. Jabatan: {jabatan}, CV: {filename}")
    
    cv_info = f"\n- Ringkasan CV: {cv_text[:1500]}" if cv_text else "\n- CV Kandidat: Tidak disediakan."
    
    prompt = f"Anda Asesor AI BKN...\nDATA KANDIDAT:\n- Jabatan: {jabatan}{cv_info}\nTUGAS: Buat 1 soal studi kasus relevan...\n**Skenario:**\n[Skenario]\n\n**Pertanyaan (3 poin):**\n1. [P1]\n2. [P2]\n3. [P3]"
    
    if provider == 'gemini': result = call_gemini_api(prompt)
    else: result = call_byteplus_api(prompt, "Anda Asesor AI BKN pembuat soal.")
    return jsonify({"case_study": result, "cv_text_cache": cv_text}) # Tetap kirim cv_text (bisa kosong)

@app.route('/api/lentera/grade-final', methods=['POST'])
def lentera_grade_final():
    # --- PROMPT BARU (SUPERHERO STYLE) ---
    data = request.json
    provider, jabatan = data.get('provider', 'gemini'), data.get('jabatan', 'Analis Kebijakan')
    cv_text, case_study, answer = data.get('cv_text_cache', ''), data.get('case_study', ''), data.get('answer', '')
    app.logger.info(f"LENTERA (Tahap 2): Grade Final. Provider: {provider}")

    nama_kandidat = "Kandidat"
    match_nama = re.search(r"(?:nama|name)\s*[:\-]*\s*(.+)", cv_text, re.IGNORECASE) if cv_text else None
    if match_nama: nama_kandidat = match_nama.group(1).strip().splitlines()[0] 
        
    osint_results = run_osint_analysis(f'"{nama_kandidat}" ASN OR PNS OR BKN')
    osint_summary = "\n".join([f"- [{res['source']}]({res['url']}): {res['snippet'][:100]}..." for res in osint_results])

    # PROMPT BARU DENGAN STRUKTUR PROFILE CARD
    prompt = f"""
    Anda adalah AI Grader BKN yang **modern dan visual**.
    Tugas Anda adalah membuat **Profil Potensi LENTERA** dalam format **Markdown** yang **detail, terstruktur seperti kartu profil**, dan **mudah dibaca**. Gunakan **skala 1-7** untuk penilaian atribut (seperti kartu superhero).

    --- DATA ---
    **Jabatan Dituju:** {jabatan}
    **Nama:** {nama_kandidat}
    **CV:** {'(Disediakan)' if cv_text else '(Tidak Disediakan)'} {cv_text[:1000] if cv_text else ''}
    **Soal:** {case_study}
    **Jawaban:** {answer}
    **OSINT:** {osint_summary}
    --- END DATA ---

    INSTRUKSI PEMBUATAN PROFIL (WAJIB DIIKUTI):
    Format output HARUS Markdown. Gunakan emoji yang relevan.

    ---
    ## 👤 PROFIL POTENSI LENTERA

    **Nama Kandidat:** {nama_kandidat}
    **Jabatan Dituju:** {jabatan}
    **Tanggal Asesmen:** [Tanggal Hari Ini, format YYYY-MM-DD] 

    ---
    ### 📊 SKOR ATRIBUT (Skala 1-7):

    * **🧠 Kualifikasi & Pengetahuan (CV):** [Angka 1-7] / 7 
        * *Justifikasi:* [Penjelasan singkat max 15 kata berdasarkan CV/Jabatan. Tulis "N/A" jika tidak ada CV.]
    * **💡 Nalar & Logika (Jawaban):** [Angka 1-7] / 7
        * *Justifikasi:* [Penjelasan singkat max 15 kata berdasarkan analisis jawaban.]
    * **🔧 Problem Solving (Jawaban):** [Angka 1-7] / 7
        * *Justifikasi:* [Penjelasan singkat max 15 kata berdasarkan kualitas solusi.]
    * **🌐 Jejak Digital (OSINT):** [Angka 1-7] / 7
        * *Justifikasi:* [Penjelasan singkat max 15 kata berdasarkan temuan OSINT (Netral=4, Positif>4, Negatif<4).]
    * **🛡️ Potensi Integritas (Jawaban):** [Angka 1-7] / 7 
        * *Justifikasi:* [Penjelasan singkat max 15 kata berdasarkan indikasi di jawaban.]

    ---
    ### 📈 REKOMENDASI & PENGEMBANGAN:

    **Rekomendasi Kelayakan:** [Pilih: **Sangat Direkomendasikan** / **Direkomendasikan** / **Dipertimbangkan** / **Butuh Pengembangan**]
    
    **Catatan Asesor AI:** [Ringkasan 1-2 kalimat tentang kekuatan utama ATAU area pengembangan kritis kandidat.]

    **Saran Pengembangan (Jika < Direkomendasikan):**
    [Jika BUKAN 'Sangat Direkomendasikan'/'Direkomendasikan', berikan 1 link relevan. Jika sudah, tulis "Tidak diperlukan."]
    * [Contoh: Pelajari Analisis Kebijakan di: https://asn.futureskills.id/fs]

    ---
    *Disclaimer: Hasil asesmen ini adalah estimasi AI berdasarkan data yang diberikan.*
    ---
    """
    
    if provider == 'gemini': result_text = call_gemini_api(prompt)
    else: result_text = call_byteplus_api(prompt, "Anda AI Grader BKN pembuat profil modern.")
    
    # Parsing Skor Total (Rata-rata Skor Atribut)
    skor_kualifikasi = parse_score(result_text, "Kualifikasi & Pengetahuan", default=4) # Default 4 (tengah)
    skor_nalar = parse_score(result_text, "Nalar & Logika", default=4)
    skor_problem = parse_score(result_text, "Problem Solving", default=4)
    skor_osint = parse_score(result_text, "Jejak Digital", default=4)
    skor_integritas = parse_score(result_text, "Potensi Integritas", default=4)
    
    # Hitung rata-rata skor 1-7, lalu konversi ke skala 1-100
    avg_score_7 = (skor_kualifikasi + skor_nalar + skor_problem + skor_osint + skor_integritas) / 5
    skor_potensi_final = round(((avg_score_7 - 1) / 6) * 100) # Konversi linear 1-7 ke 0-100
            
    return jsonify({
        "grading_result": result_text, # Kirim teks Markdown lengkap
        "skor_potensi": skor_potensi_final # Kirim skor numerik 0-100
    })

# --- ENDPOINT BARU: EXPORT PDF ---
@app.route('/api/lentera/export-pdf', methods=['POST'])
def export_lentera_pdf():
    data = request.json
    markdown_profile = data.get('profile_markdown', '')
    nama_kandidat = data.get('nama_kandidat', 'Kandidat') # Ambil nama untuk nama file
    
    if not markdown_profile:
        return jsonify({"error": "Data profil tidak ditemukan"}), 400
        
    app.logger.info(f"LENTERA: Memulai generate PDF untuk {nama_kandidat}")
    
    pdf_buffer = generate_pdf_from_markdown(markdown_profile)
    
    if pdf_buffer:
        safe_filename = secure_filename(f"Profil_Lentera_{nama_kandidat}.pdf")
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=safe_filename
        )
    else:
        app.logger.error("Gagal membuat PDF buffer.")
        return jsonify({"error": "Gagal mengenerate PDF"}), 500
# --- MODUL 2: SELAYAR ---

@app.route('/api/selayar/osint-sentiment', methods=['POST'])
def selayar_osint_sentiment():
    # --- PROMPT BARU (Lebih terstruktur) ---
    data = request.json; program_kerja, provider = data.get('program', 'Pelayanan Publik'), data.get('provider', 'byteplus')
    app.logger.info(f"SELAYAR (OSINT): Dipicu. Program: {program_kerja}, Provider: {provider}")
    osint_articles = run_osint_analysis(program_kerja)
    if not osint_articles: return jsonify({"error": "Gagal menjalankan OSINT"}), 500
    osint_snippets = "\n".join([f"- [{a['source']}]: {a['snippet'][:150]}..." for a in osint_articles if a['snippet']])
    
    prompt = f"""
    Anda adalah AI Analis Sentimen Publik yang **ringkas dan to-the-point**.
    Berdasarkan cuplikan berita OSINT berikut tentang "{program_kerja}":
    ---
    {osint_snippets}
    ---
    TUGAS: Berikan output dalam format Markdown berikut:

    **Analisis Sentimen Publik (OSINT):**
    * **Sentimen Umum:** [Pilih: **Positif** / **Negatif** / **Netral** / **Campuran**]
    * **Skor Sentimen (Estimasi):** [Angka 1-100] / 100
    * **Ringkasan Utama:** [1 kalimat ringkasan sentimen berdasarkan berita]
    """
    
    if provider == 'gemini': sentiment_summary = call_gemini_api(prompt)
    else: sentiment_summary = call_byteplus_api(prompt, "Anda analis sentimen publik ringkas.")
        
    # Parsing Skor Sentimen
    skor_sentimen = parse_score(sentiment_summary, "Skor Sentimen")

    return jsonify({
        "program": program_kerja, 
        "sentiment_analysis_text": sentiment_summary, # Teks lengkap
        "sentiment_score": skor_sentimen, # Skor numerik
        "articles": osint_articles 
    })

@app.route('/api/selayar/analyze-skp', methods=['POST'])
def selayar_analyze_skp():
    # --- PROMPT BARU (PROFILE CARD STYLE) ---
    if 'file_skp' not in request.files: return jsonify({"error": "File SKP tidak terdeteksi"}), 400
    file_skp, provider = request.files['file_skp'], request.form.get('provider', 'gemini')
    filename = secure_filename(file_skp.filename); file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename); file_skp.save(file_path)
    app.logger.info(f"SELAYAR (SKP): Analyze Artifact. File: {filename}")
    doc_text = extract_text_from_file(file_path); os.remove(file_path)
    if not doc_text: return jsonify({"error": "Gagal membaca teks SKP"}), 500

    prompt = f"""
    Anda adalah AI Analis Kinerja ASN yang **modern dan visual**.
    Tugas Anda adalah membuat **Profil Kinerja SELAYAR** dalam format **Markdown** terstruktur.

    --- DOKUMEN SKP/LAPORAN ---
    {doc_text[:9000]}
    --- AKHIR DOKUMEN ---

    INSTRUKSI PEMBUATAN PROFIL (WAJIB DIIKUTI):
    Format output HARUS Markdown. Gunakan **skala 1-7** untuk penilaian atribut.

    ---
    ## 📋 PROFIL KINERJA SELAYAR

    **Periode Penilaian:** [Coba deteksi periode dari dokumen, jika tidak tulis "Tidak Terdeteksi"]
    **Dokumen Sumber:** {filename}

    ---
    ### 📊 SKOR ATRIBUT KINERJA (Skala 1-7):

    * **🎯 Pencapaian Target:** [Angka 1-7] / 7
        * *Justifikasi:* [Analisis ringkas (max 15 kata) pencapaian target utama.]
    * **💼 Kontribusi & Inisiatif:** [Angka 1-7] / 7
        * *Justifikasi:* [Analisis ringkas (max 15 kata) kontribusi/inisiatif di luar target.]
    * **✍️ Kualitas Pelaporan:** [Angka 1-7] / 7
        * *Justifikasi:* [Analisis ringkas (max 15 kata) kejelasan dan kelengkapan laporan.]

    ---
    ### 📝 CATATAN ASESOR AI:

    * **Kekuatan Utama:** [Sebutkan 1-2 kekuatan kinerja yang menonjol.]
    * **Area Pengembangan:** [Sebutkan 1 area utama yang bisa ditingkatkan.]

    **Saran Pengembangan:** [Berikan 1 saran *actionable* berdasarkan analisis di atas.]

    ---
    *Disclaimer: Hasil analisis ini adalah estimasi AI berdasarkan dokumen yang diberikan.*
    ---
    """
    
    if provider == 'gemini': result_text = call_gemini_api(prompt)
    else: result_text = call_byteplus_api(prompt, "Anda AI Analis Kinerja ASN pembuat profil.")
    
    # Parsing Skor Kinerja (Rata-rata Atribut 1-7 -> 0-100)
    skor_target = parse_score(result_text, "Pencapaian Target", default=4)
    skor_kontribusi = parse_score(result_text, "Kontribusi & Inisiatif", default=4)
    skor_kualitas = parse_score(result_text, "Kualitas Pelaporan", default=4)
    avg_score_7 = (skor_target + skor_kontribusi + skor_kualitas) / 3
    skor_kinerja_final = round(((avg_score_7 - 1) / 6) * 100)
        
    return jsonify({
        "artifact_analysis": result_text, # Teks Markdown lengkap
        "skor_kinerja": skor_kinerja_final # Skor numerik 0-100
    })

# --- MODUL 3: NAKHODA (Sama seperti V2.1) ---
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