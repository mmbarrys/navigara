from flask import Flask, jsonify, request
from flask_cors import CORS
import networkx as nx
import json
import os
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
CORS(app)
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
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
app.logger.info("Server NAVIGARA (Python) v2.1 (Google OSINT) Dimulai...")

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
    except Exception as e:
        app.logger.error(f"Gagal konfigurasi Gemini: {str(e)}")
        gemini_model = None
else:
    app.logger.warning("GEMINI_API_KEY tidak ditemukan.")
    gemini_model = None

# Klien Google Search
if GOOGLE_API_KEY and GOOGLE_CSE_ID:
    try:
        google_search_service = build("customsearch", "v1", developerKey=GOOGLE_API_KEY)
        app.logger.info("Klien Google Custom Search berhasil dikonfigurasi.")
    except Exception as e:
        app.logger.error(f"Gagal konfigurasi Google Search: {str(e)}")
        google_search_service = None
else:
    app.logger.warning("GOOGLE_API_KEY atau GOOGLE_CSE_ID tidak ditemukan. Modul OSINT akan dibatasi.")
    google_search_service = None

if not BYTEPLUS_KEY:
    app.logger.warning("BYTEPLUS_API_KEY tidak ditemukan.")

# --- Helper: Ekstraksi Teks File ---
def extract_text_from_file(file_path):
    try:
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path)
            text = "".join(page.get_text() for page in doc)
            doc.close()
            return text
        elif file_path.lower().endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        return None
    except Exception as e:
        app.logger.error(f"Gagal mengekstrak file {file_path}: {str(e)}")
        return None

# --- Helper: Fungsi Panggilan AI ---
def call_gemini_api(prompt):
    if not gemini_model: return "Error: Klien API Gemini tidak terkonfigurasi."
    try:
        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        app.logger.error(f"Error API Gemini: {str(e)}")
        return f"Error: Gagal memanggil API Gemini. {str(e)}"

def call_byteplus_api(prompt, system_prompt="Anda adalah asisten AI yang membantu."):
    if not BYTEPLUS_KEY: return "Error: Klien API Byteplus tidak terkonfigurasi."
    headers = {"Authorization": f"Bearer {BYTEPLUS_KEY}", "Content-Type": "application/json"}
    payload = {"model": BYTEPLUS_MODEL_NAME, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]}
    try:
        response = requests.post(BYTEPLUS_API_ENDPOINT, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except requests.exceptions.ReadTimeout:
        return "Error: Gagal memanggil API Byteplus (Read Timed Out)."
    except Exception as e:
        app.logger.error(f"Error API Byteplus: {str(e)}")
        return f"Error: Gagal memanggil API Byteplus. {str(e)}"

# --- Helper: OSINT Engine (Google Search) ---
def run_osint_analysis(query):
    app.logger.info(f"OSINT Engine: Menjalankan kueri Google untuk '{query}'")
    articles_output = []
    if not google_search_service:
        articles_output.append({"source": "Sistem", "title": "Google Search API tidak dikonfigurasi", "url": "#", "snippet": "Pastikan GOOGLE_API_KEY dan GOOGLE_CSE_ID ada di .env"})
        return articles_output
    try:
        result = google_search_service.cse().list(q=query, cx=GOOGLE_CSE_ID, num=5, gl='id').execute()
        if 'items' not in result:
            return [{"source": "Google Search", "title": "Tidak ada hasil ditemukan", "url": "#", "snippet": "Kueri Anda tidak menemukan dokumen yang relevan."}]
        for item in result['items']:
            articles_output.append({
                "source": item.get('displayLink', 'Unknown Source'),
                "title": item.get('title', 'No Title'),
                "url": item.get('link', '#'),
                "snippet": item.get('snippet', 'No Snippet')
            })
    except Exception as e:
        app.logger.error(f"Error Google Search API: {str(e)}")
        if "quota" in str(e).lower():
             articles_output.append({"source": "Google Search", "title": "Error Kuota Gratis Habis", "url": "#", "snippet": "Kuota 100 kueri/hari mungkin telah terlampaui."})
        else:
            articles_output.append({"source": "Google Search", "title": f"Error API: {str(e)}", "url": "#", "snippet": "Periksa API Key / CSE ID Anda."})
    return articles_output

# --- MODUL 1: LENTERA (Alur Baru) ---
@app.route('/api/lentera/generate-case', methods=['POST'])
def lentera_generate_case():
    if 'file_cv' not in request.files: return jsonify({"error": "File CV tidak terdeteksi"}), 400
    file_cv, provider, jabatan = request.files['file_cv'], request.form.get('provider', 'gemini'), request.form.get('jabatan', 'Analis Kebijakan')
    filename = secure_filename(file_cv.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file_cv.save(file_path)
    app.logger.info(f"LENTERA (Tahap 1): Generate Case. File: {filename}, Jabatan: {jabatan}")
    cv_text = extract_text_from_file(file_path)
    os.remove(file_path)
    if not cv_text: return jsonify({"error": "Gagal membaca teks dari file CV"}), 500

    prompt = f"Anda adalah Asesor AI BKN...\nDATA KANDIDAT:\n- Jabatan yang dituju: {jabatan}\n- Ringkasan CV: {cv_text[:2000]}\n\nTUGAS:\nBuat 1 (satu) soal studi kasus yang SANGAT RELEVAN...\n**Skenario:**\n[Skenario]\n\n**Pertanyaan (3 poin):**\n1. [Pertanyaan 1]\n2. [Pertanyaan 2]\n3. [Pertanyaan 3]"
    
    if provider == 'gemini': result = call_gemini_api(prompt)
    else: result = call_byteplus_api(prompt, "Anda adalah Asesor AI BKN pembuat soal.")
    return jsonify({"case_study": result, "cv_text_cache": cv_text})

@app.route('/api/lentera/grade-final', methods=['POST'])
def lentera_grade_final():
    data = request.json
    provider, jabatan = data.get('provider', 'gemini'), data.get('jabatan', 'Analis Kebijakan')
    cv_text, case_study, answer = data.get('cv_text_cache', ''), data.get('case_study', ''), data.get('answer', '')
    app.logger.info(f"LENTERA (Tahap 2): Grade Final dipicu. Provider: {provider}")

    nama_kandidat = "Kandidat"
    for line in cv_text.splitlines():
        if "nama:" in line.lower() or "name:" in line.lower():
            nama_kandidat = line.split(":")[-1].strip()
            break
    osint_results = run_osint_analysis(f'"{nama_kandidat}" ASN OR PNS OR BKN')
    osint_summary = "\n".join([f"- {res['title']} ({res['source']})" for res in osint_results])

    prompt = f"Anda adalah AI Grader BKN...\n--- DATA 1: JABATAN DITUJU ---\n{jabatan}\n--- DATA 2: CV KANDIDAT ---\n{cv_text[:2000]}\n--- DATA 3: SOAL STUDI KASUS ---\n{case_study}\n--- DATA 4: JAWABAN KANDIDAT ---\n{answer}\n--- DATA 5: HASIL OSINT (Jejak Digital) ---\n{osint_summary}\n\nTUGAS:\nBuat \"Profil Potensi LENTERA\"...\n**1. Analisis Kualifikasi (CV vs Jabatan):**\n[Analisis]\n**2. Analisis Studi Kasus (Nalar & Problem-Solving):**\n[Analisis]\n**3. Analisis Jejak Digital (OSINT):**\n[Analisis]\n**4. Skor Potensi (1-100):**\n* Kesesuaian Kualifikasi: [Skor / 100]\n* Logika & Nalar (Jawaban): [Skor / 100]\n* Total Skor Potensi: [Rata-rata Skor]\n**5. Rekomendasi Kelayakan:**\n[Direkomendasikan/Butuh Pengembangan]\n**6. Rekomendasi Pembelajaran (Jika Butuh Pengembangan):**\n[Link ke https://asn.futureskills.id/fs atau https://elearning.bsn.go.id/]"
    
    if provider == 'gemini': result = call_gemini_api(prompt)
    else: result = call_byteplus_api(prompt, "Anda adalah AI Grader BKN.")
    
    # Parsing Skor (Simulasi Sederhana)
    skor_potensi_final = 50 # Default
    try:
        # Cari baris yang mengandung "Total Skor Potensi:"
        for line in result.splitlines():
             if "total skor potensi:" in line.lower():
                 # Ekstrak angka setelah ':'
                 skor_str = line.split(":")[-1].strip()
                 skor_potensi_final = int(skor_str)
                 break
    except:
        pass # Biarkan default jika parsing gagal
        
    return jsonify({
        "grading_result": result, 
        "skor_potensi": skor_potensi_final # Kirim skor terpisah
    })

# --- MODUL 2: SELAYAR (Alur Baru) ---
@app.route('/api/selayar/osint-sentiment', methods=['POST'])
def selayar_osint_sentiment():
    data = request.json
    program_kerja, provider = data.get('program', 'Pelayanan Publik'), data.get('provider', 'byteplus')
    app.logger.info(f"SELAYAR (OSINT): Dipicu. Program: {program_kerja}, Provider: {provider}")
    osint_articles = run_osint_analysis(program_kerja)
    if not osint_articles: return jsonify({"error": "Gagal menjalankan OSINT"}), 500
    osint_snippets = "\n".join([f"- {a['snippet']}" for a in osint_articles if a['snippet']])
    prompt = f"Anda adalah AI Analis Sentimen Publik...\nBerdasarkan cuplikan berita (OSINT) berikut tentang \"{program_kerja}\":\n---\n{osint_snippets}\n---\nTugas: Berikan analisis sentimen singkat (Positif/Negatif/Netral) dan 1 kalimat ringkasan mengapa."
    
    if provider == 'gemini': sentiment_summary = call_gemini_api(prompt)
    else: sentiment_summary = call_byteplus_api(prompt, "Anda adalah analis sentimen publik.")
    return jsonify({"program": program_kerja, "sentiment_summary": sentiment_summary, "articles": osint_articles})

@app.route('/api/selayar/analyze-skp', methods=['POST'])
def selayar_analyze_skp():
    if 'file_skp' not in request.files: return jsonify({"error": "File SKP tidak terdeteksi"}), 400
    file_skp, provider = request.files['file_skp'], request.form.get('provider', 'gemini')
    filename = secure_filename(file_skp.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file_skp.save(file_path)
    app.logger.info(f"SELAYAR (SKP): Analyze Artifact dipicu. File: {filename}")
    doc_text = extract_text_from_file(file_path)
    os.remove(file_path)
    if not doc_text: return jsonify({"error": "Gagal membaca teks dari file SKP"}), 500

    prompt = f"Anda adalah AI Analis Kinerja ASN...\nBerdasarkan dokumen SKP/Laporan Kinerja berikut:\n---\n{doc_text[:4000]}\n---\nAnalisis dan berikan poin-poin berikut (gunakan **bold** dan list):\n**1. Ringkasan Kontribusi Nyata:**\n* [Kontribusi 1]\n* [Kontribusi 2]\n**2. Analisis Pencapaian Target:**\n* [Analisis]\n**3. Skor Kinerja (Estimasi AI):**\n* [Skor / 100]\n**4. Saran Peningkatan (Otomatis):**\n* [Saran 1]"
    
    if provider == 'gemini': result = call_gemini_api(prompt)
    else: result = call_byteplus_api(prompt, "Anda adalah AI Analis Kinerja ASN.")
    
    # Parsing Skor Kinerja (Simulasi)
    skor_kinerja_final = 50
    try:
        for line in result.splitlines():
             if "skor kinerja" in line.lower() or "skor / 100" in line.lower():
                 skor_str = line.split(":")[-1].split("/")[0].strip()
                 skor_kinerja_final = int(skor_str)
                 break
    except:
        pass
        
    return jsonify({
        "artifact_analysis": result, 
        "skor_kinerja": skor_kinerja_final # Kirim skor terpisah
    })

# --- MODUL 3: NAKHODA (Sama seperti V2) ---
# ... (Semua fungsi NAKHODA: analyze_graph, get_graph, load_custom_graph, simulate_move tetap sama persis seperti V2) ...
# ... (Pastikan Anda menyalin SEMUA fungsi Nakhoda dari app.py sebelumnya ke sini) ...
def analyze_graph(pegawai_list, kolaborasi_list):
    G = nx.Graph()
    for p in pegawai_list:
        potensi = p.get('skor_potensi', 50)
        kinerja = p.get('skor_kinerja', 50)
        combined_score = (kinerja * 0.6) + (potensi * 0.4)
        G.add_node(p['id'], label=p['nama'], unit=p['unit'], jabatan=p['jabatan'], score=combined_score)
    for k in kolaborasi_list:
        if G.has_node(k['source']) and G.has_node(k['target']):
            G.add_edge(k['source'], k['target'], label=k['project'])
    if not G.nodes: return {"nodes": [], "edges": [], "metrics": {"total_pegawai": 0, "total_kolaborasi": 0, "avg_effectiveness": 0, "num_silos": 0}}
    centrality = nx.degree_centrality(G)
    num_silos = nx.number_connected_components(G)
    total_effectiveness_score = sum((G.nodes[n].get('score', 50) * (1 + centrality.get(n, 0))) for n in G.nodes())
    nodes_for_reactflow = []
    for node in G.nodes(data=True):
        node_id, node_data = node
        node_score = node_data.get('score', 50)
        background_color = '#90EE90' if node_score > 80 else ('#FFD700' if node_score > 60 else '#F08080')
        nodes_for_reactflow.append({"id": node_id, "position": {"x": 0, "y": 0},"data": {"label": f"{node_data['label']} ({node_data['unit']})\nSkor: {node_score:.0f}"},"style": { "background": background_color, "border": "1px solid #333", "whiteSpace": "pre-line", "textAlign": "center"}})
    edges_for_reactflow = [{"id": f"e-{e[0]}-{e[1]}", "source": e[0], "target": e[1], "label": e[2].get('label', ''), "animated": True} for e in G.edges(data=True)]
    metrics = {"total_pegawai": G.number_of_nodes(), "total_kolaborasi": G.number_of_edges(), "avg_effectiveness": total_effectiveness_score / G.number_of_nodes(), "num_silos": num_silos}
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