import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';

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
  
  const [gradingResult, setGradingResult] = useState(''); // Teks lengkap dari AI
  const [finalPotentialScore, setFinalPotentialScore] = useState(null); // Skor numerik
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
        setSelectedCV(file);
        setCvFileName(file.name);
        // Reset state jika file diganti
        setStep(1);
        setCaseStudy('');
        setGradingResult('');
        setError('');
    }
  };
// --- TAHAP 1: Generate Case Study ---
  const handleGenerateCase = async () => {
    if (!selectedCV || !jabatan) {
      setError('Error: Harap pilih file CV dan isi Jabatan yang Dituju.');
      return;
    }
    setLoading(true);
    setError('');
    setCaseStudy('');
    setCvTextCache('');
    setGradingResult(''); // Reset hasil sebelumnya

    const formData = new FormData();
    formData.append('file_cv', selectedCV);
    formData.append('jabatan', jabatan);
    formData.append('provider', provider);

    try {
      const response = await axios.post(`${API_URL}/api/lentera/generate-case`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCaseStudy(response.data.case_study);
      setCvTextCache(response.data.cv_text_cache);
      setStep(2); // Lanjut ke step 2
    } catch (err) {
      setError(`Error Tahap 1: ${err.response?.data?.error || "Gagal membuat studi kasus."}`);
    }
    setLoading(false);
  };

  // --- TAHAP 2: Grade Final (Update State) ---
  const handleGradeFinal = async () => {
    if (!caseStudyAnswer) { setError('Error: Harap isi jawaban studi kasus.'); return; }
    setLoading(true); setError(''); setGradingResult(''); setFinalPotentialScore(null);
    try {
      const response = await axios.post(`${API_URL}/api/lentera/grade-final`, {
        provider, jabatan, cv_text_cache: cvTextCache, case_study: caseStudy, answer: caseStudyAnswer
      });
      setGradingResult(response.data.grading_result); // Simpan teks lengkap
      const score = response.data.skor_potensi; // Ambil skor numerik
      setFinalPotentialScore(score); 
      setCandidateScores(prev => ({ ...prev, skor_potensi: score, nama: `Kandidat (${jabatan})` }));
      setStep(3);
    } catch (err) { setError(`Error Tahap 2: ${err.response?.data?.error || "Gagal menilai."}`); }
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
  }

  return (
    <div className="module-container">
      <h2>Modul LENTERA - Asesmen Talenta Adaptif</h2>
      {/* Tombol Reset */}
      <button onClick={resetAll} style={{ float: 'right', background: '#aaa', marginBottom: '10px' }}>Reset Form</button>
      
      {/* AI Provider Selector */
      <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
        <label>Pilih AI Provider: </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loading}>
          <option value="gemini">Google Gemini</option>
          <option value="byteplus">Byteplus ARK</option>
        </select>
      </div>}
      {error && <div className="result-box error-box"><h4>Error:</h4><p>{error}</p></div>}

      {/* --- TAHAP 1 (Sama) --- */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: step === 1 ? '5px solid var(--accent-blue)' : '5px solid transparent' }}>
        <h3>Tahap 1: Input Data & Generate Soal</h3>
        <label>Jabatan yang Dituju:</label>
        <input type="text" value={jabatan} onChange={(e) => setJabatan(e.target.value)} disabled={loading || step > 1}/>
        
        <label style={{display: 'block', marginBottom: '5px'}}>Upload CV Kandidat (PDF/TXT):</label>
        <input type="file" accept=".pdf,.txt" onChange={handleFileChange} disabled={loading || step > 1}/>
        {cvFileName && <span> File: {cvFileName}</span>}
        
        <button onClick={handleGenerateCase} disabled={loading || step > 1 || !selectedCV || !jabatan} style={{marginTop: '15px'}}>
          {loading && step === 1 ? 'Membuat Soal...' : 'Lanjut ke Tahap 2: Buat Soal Kasus'}
        </button>
      </div>

      {/* --- TAHAP 2 (Sama) --- */}
<div className="card" style={{ marginBottom: '20px', opacity: step >= 2 ? 1 : 0.4, borderLeft: step === 2 ? '5px solid var(--accent-blue)' : '5px solid transparent' }}>
        <h3>Tahap 2: Jawab Studi Kasus</h3>
        {step >= 2 && caseStudy && (
          <div className="result-box" style={{background: 'rgba(0,0,0,0.1)'}}>
            <h4>Studi Kasus (dari AI):</h4>
            <AiOutput text={caseStudy} />
          </div>
        )}
        <label>Jawaban Anda:</label>
        <textarea
          placeholder={step < 2 ? "Selesaikan Tahap 1 dulu..." : "Tulis jawaban Anda di sini..."}
          value={caseStudyAnswer}
          onChange={(e) => setCaseStudyAnswer(e.target.value)}
          disabled={loading || step !== 2}
        />
        <button onClick={handleGradeFinal} disabled={loading || step !== 2 || !caseStudyAnswer}>
          {loading && step === 2 ? 'Menganalisis...' : 'Lanjut ke Tahap 3: Dapatkan Penilaian'}
        </button>
      </div>

      {/* --- TAHAP 3 (Update Tampilan Skor) --- */}
      <div className="card" style={{ opacity: step === 3 ? 1 : 0.4, borderLeft: step === 3 ? '5px solid var(--color-primary)' : '5px solid transparent' }}>
        <h3>Tahap 3: Hasil Penilaian</h3>
        {loading && step === 3 && <p>Memuat hasil...</p>}
        {step === 3 && gradingResult && (
          <div className="result-box">
            <h4>Profil Potensi LENTERA (Hasil Penilaian AI):</h4>
            <AiOutput text={gradingResult} /> {/* Tampilkan teks lengkap */}
            {/* Tampilkan skor numerik secara terpisah */}
            {finalPotentialScore !== null && (
              <p style={{ marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)', borderTop: '1px solid var(--color-border)', paddingTop: '15px' }}>
                SKOR TOTAL POTENSI (Numerik): {finalPotentialScore} / 100
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lentera;