import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';
import { Download } from 'lucide-react'; // Ikon download

function Lentera() {
  const { setCandidateScores } = useAppContext();
  
  const [provider, setProvider] = useState('gemini');
  const [jabatan, setJabatan] = useState('Analis Kebijakan Ahli Madya');
  const [selectedCV, setSelectedCV] = useState(null);
  const [cvFileName, setCvFileName] = useState('');
  
  const [step, setStep] = useState(1);
  
  const [caseStudy, setCaseStudy] = useState('');
  const [cvTextCache, setCvTextCache] = useState('');
  const [caseStudyAnswer, setCaseStudyAnswer] = useState('');
  
  const [gradingResult, setGradingResult] = useState('');
  const [finalPotentialScore, setFinalPotentialScore] = useState(null);
  const [candidateName, setCandidateName] = useState('Kandidat'); // Untuk nama file PDF
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
        setSelectedCV(file);
        setCvFileName(file.name);
        setStep(1); setCaseStudy(''); setGradingResult(''); setError('');
    } else { // Jika batal pilih file
        setSelectedCV(null);
        setCvFileName('');
    }
  };

  // --- TAHAP 1: Generate Case Study (CV Opsional) ---
  const handleGenerateCase = async () => {
    // CV tidak wajib lagi
    // if (!selectedCV || !jabatan) { setError('Error: Harap pilih file CV dan isi Jabatan.'); return; }
    if (!jabatan) { setError('Error: Harap isi Jabatan yang Dituju.'); return; }
    
    setLoading(true); setError(''); setCaseStudy(''); setCvTextCache(''); setGradingResult('');

    const formData = new FormData();
    // Kirim file HANYA jika dipilih
    if (selectedCV) {
        formData.append('file_cv', selectedCV);
    }
    formData.append('jabatan', jabatan);
    formData.append('provider', provider);

    try {
      const response = await axios.post(`${API_URL}/api/lentera/generate-case`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, // Header tetap diperlukan
      });
      setCaseStudy(response.data.case_study);
      setCvTextCache(response.data.cv_text_cache || ''); // Simpan cache (bisa kosong)
      setStep(2);
    } catch (err) { setError(`Error Tahap 1: ${err.response?.data?.error || "Gagal."}`); }
    setLoading(false);
  };
  
  // --- TAHAP 2: Grade Final ---
  const handleGradeFinal = async () => {
    if (!caseStudyAnswer) { setError('Error: Harap isi jawaban studi kasus.'); return; }
    setLoading(true); setError(''); setGradingResult(''); setFinalPotentialScore(null);
    try {
      const response = await axios.post(`${API_URL}/api/lentera/grade-final`, {
        provider, jabatan, cv_text_cache: cvTextCache, case_study: caseStudy, answer: caseStudyAnswer
      });
      const resultText = response.data.grading_result;
      const score = response.data.skor_potensi;
      setGradingResult(resultText);
      setFinalPotentialScore(score);
      
      // Ekstrak nama dari hasil AI untuk nama file PDF
      const nameMatch = resultText.match(/Nama Kandidat:\s*(.+)/i);
      const extractedName = nameMatch ? nameMatch[1].trim() : 'Kandidat';
      setCandidateName(extractedName);
      
      setCandidateScores(prev => ({ ...prev, skor_potensi: score, nama: extractedName || `Kandidat (${jabatan})` }));
      setStep(3);
    } catch (err) { setError(`Error Tahap 2: ${err.response?.data?.error || "Gagal."}`); }
    setLoading(false);
  };
  
  // --- FUNGSI BARU: Export PDF ---
   const handleExportPdf = async () => {
        if (!gradingResult) return;
        setLoading(true); // Gunakan state loading utama
        setError('');
        try {
            const response = await axios.post(`${API_URL}/api/lentera/export-pdf`,
                { profile_markdown: gradingResult, nama_kandidat: candidateName },
                { responseType: 'blob' } // Penting: minta respons sebagai data biner (file)
            );

            // Buat URL sementara dari blob dan trigger download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            // Ambil nama file dari header Content-Disposition jika ada, fallback ke nama default
            const contentDisposition = response.headers['content-disposition'];
            let filename = `Profil_Lentera_${candidateName.replace(/\s+/g, '_')}.pdf`; // Nama default
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch && filenameMatch.length > 1) {
                    filename = filenameMatch[1];
                }
            }
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();

            // Hapus URL sementara
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (err) {
            setError(`Error Ekspor PDF: ${err.response?.data?.error || err.message || "Gagal."}`);
        }
        setLoading(false);
    };

  const resetAll = () => { 
    setProvider('gemini');
      setJabatan('Analis Kebijakan Ahli Madya');
      setSelectedCV(null);
      setCvFileName('');
      setStep(1);
      setCaseStudy('');
      setCvTextCache('');
      setCaseStudyAnswer('');
      setGradingResult('');
      setFinalPotentialScore(null);
      setLoading(false);
      setError('');
  };

  return (
    <div className="module-container">
      <h2>Modul LENTERA - Asesmen Talenta Adaptif</h2>
      <button onClick={resetAll} style={{ float: 'right', background: '#aaa', marginBottom: '10px' }}>Reset Form</button>
      <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)' }}>
        <label>Pilih AI Provider: </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loading}>
          <option value="gemini">Google Gemini</option>
          <option value="byteplus">Byteplus ARK</option>
        </select>
      </div>
      {error && <div className="result-box error-box"><h4>Error:</h4><p>{error}</p></div>}

      {/* --- TAHAP 1 --- */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: step === 1 ? '5px solid var(--color-primary)' : '5px solid transparent' }}>
        <h3>Tahap 1: Input Data & Generate Soal</h3>
        <label>Jabatan yang Dituju:</label>
        <input type="text" value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Cth: Analis Kebijakan Ahli Madya" disabled={loading || step > 1}/>
        <label style={{display: 'block', marginBottom: '5px'}}>Upload CV Kandidat (PDF/TXT) - Opsional:</label>
        <input type="file" accept=".pdf,.txt" onChange={handleFileChange} disabled={loading || step > 1}/>
        {cvFileName && <span> File: {cvFileName}</span>}
        <button onClick={handleGenerateCase} disabled={loading || step > 1 || !jabatan} style={{marginTop: '15px'}}>
          {loading && step === 1 ? 'Membuat Soal...' : 'Lanjut ke Tahap 2: Buat Soal Kasus'}
        </button>
        {caseStudy && step >= 2 && ( // Tampilkan hanya jika sudah generate
          <div className="result-box"> 
            <h4>Studi Kasus (Dibuat oleh AI):</h4>
            <AiOutput text={caseStudy} />
          </div>
        )}
      </div>

      {/* --- TAHAP 2 --- */}
      <div className="card" style={{ marginBottom: '20px', opacity: step >= 2 ? 1 : 0.4, borderLeft: step === 2 ? '5px solid var(--color-primary)' : '5px solid transparent' }}>
        <h3>Tahap 2: Jawab Studi Kasus</h3>
        <label>Jawaban Anda:</label>
        <textarea placeholder={step < 2 ? "Selesaikan Tahap 1..." : "Tulis jawaban..."} value={caseStudyAnswer} onChange={(e) => setCaseStudyAnswer(e.target.value)} disabled={loading || step !== 2} />
        <button onClick={handleGradeFinal} disabled={loading || step !== 2 || !caseStudyAnswer}>
          {loading && step === 2 ? 'Menganalisis...' : 'Lanjut ke Tahap 3: Dapatkan Penilaian'}
        </button>
      </div>

      {/* --- TAHAP 3 --- */}
      <div className="card" style={{ opacity: step === 3 ? 1 : 0.4, borderLeft: step === 3 ? '5px solid var(--color-primary)' : '5px solid transparent' }}>
        <h3>Tahap 3: Hasil Penilaian</h3>
        {loading && step === 3 && <p>Memuat hasil...</p>}
        {step === 3 && gradingResult && (
          <> {/* Gunakan Fragment */}
            {/* Tombol Export PDF BARU */}
            <button onClick={handleExportPdf} disabled={loading} style={{ float: 'right', background: 'var(--color-success)'}}>
               <Download size={18} style={{ marginRight: '5px' }}/> Export PDF
            </button>
            <div className="result-box" style={{marginTop: '50px'}}> {/* Beri jarak dari tombol */}
              {/* <h4>Profil Potensi LENTERA (Hasil Penilaian AI):</h4> (Judul sudah ada di dalam markdown) */}
              <AiOutput text={gradingResult} /> 
              {/* Skor numerik tidak perlu ditampilkan lagi karena sudah ada di dalam profil */}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Lentera;