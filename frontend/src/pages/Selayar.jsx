import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';

function Selayar() {
  const { setCandidateScores } = useAppContext(); 
  
  const [provider, setProvider] = useState('byteplus');
  const [program, setProgram] = useState('Digitalisasi Layanan Pertanahan');
  const [sentimentResult, setSentimentResult] = useState(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  
  const [skpResult, setSkpResult] = useState('');
  const [selectedSkp, setSelectedSkp] = useState(null);
  const [skpFileName, setSkpFileName] = useState('');
  const [finalPerformanceScore, setFinalPerformanceScore] = useState(null);
  const [loadingSkp, setLoadingSkp] = useState(false);
  const [error, setError] = useState('');

  // Fungsi 1: Analisis Sentimen (OSINT)
  const handleAnalyzeSentiment = async () => {
    setLoadingSentiment(true);
    setSentimentResult(null);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/selayar/osint-sentiment`, { program, provider });
      setSentimentResult(response.data);
    } catch (error) {
      setError(`Error OSINT: ${error.response?.data?.message ?? "Gagal."}`);
    }
    setLoadingSentiment(false);
  };

  // --- Upload SKP
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedSkp(file);
      setSkpFileName(file.name);
      setSkpResult(''); // Reset hasil jika file diganti
      setError('');
    }
  };

  // --- Analisis SKP
  const handleAnalyzeSkp = async () => {
    if (!selectedSkp) { 
      setError('Error: Pilih file SKP dulu.'); 
      return; 
    }
    setLoadingSkp(true); 
    setSkpResult(''); 
    setFinalPerformanceScore(null); 
    setError('');

    const formData = new FormData();
    formData.append('file_skp', selectedSkp);
    formData.append('provider', provider);

    try {
      const response = await axios.post(`${API_URL}/api/selayar/analyze-skp`, formData, { 
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSkpResult(response.data.artifact_analysis);
      const score = response.data.skor_kinerja;
      setFinalPerformanceScore(score);
      setCandidateScores(prev => ({ ...prev, skor_kinerja: score }));
    } catch (error) {
      setError(`Error Analisis SKP: ${error.response?.data?.error ?? "Gagal."}`);
    }
    setLoadingSkp(false);
  };

  return (
    <div className="module-container">
      <h2>Modul SELAYAR - Audit Kinerja & Dampak Publik</h2>

      <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
        <label>Pilih AI Provider: </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loadingSentiment || loadingSkp}>
          <option value="gemini">Google Gemini</option>
          <option value="byteplus">Byteplus ARK</option>
        </select>
      </div>

      {error && <div className="result-box error-box"><h4>Error:</h4><p>{error}</p></div>}

      {/* --- Bagian 1: OSINT --- */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>1. Analisis Dampak Publik (OSINT via Google Search)</h3>
        <label>Program Kerja / Kata Kunci:</label>
        <input 
          type="text" 
          value={program} 
          onChange={(e) => setProgram(e.target.value)} 
          placeholder="Cth: Digitalisasi Layanan Pertanahan"
          disabled={loadingSentiment}
        />
        <button onClick={handleAnalyzeSentiment} disabled={loadingSentiment}>
          {loadingSentiment ? 'Menganalisis...' : 'Jalankan OSINT & Analisis Sentimen'}
        </button>
        {loadingSentiment && <p>Menarik berita dari Google...</p>}
        {sentimentResult && (
          <div style={{ marginTop: '20px' }}>
            <div className="result-box"> 
              <strong>Ringkasan Sentimen (dari AI):</strong>
              <AiOutput text={sentimentResult.sentiment_summary} />
            </div>
            <h4 style={{color: 'var(--color-primary)', marginTop: '20px'}}>Sumber Google Search:</h4>
            <ul className="osint-list">
              {sentimentResult.articles.map((article) => (
                <li key={article.url} className="osint-item">
                  <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
                  <p>{article.snippet}</p>
                  <span>Sumber: {article.source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* --- Bagian 2: SKP --- */}
      <div className="card">
        <h3>2. Analisis Kinerja Internal (Upload SKP)</h3>
        <label style={{display: 'block', marginBottom: '5px'}}>Upload Dokumen SKP / Laporan (PDF/TXT):</label>
        <input type="file" accept=".pdf,.txt" onChange={handleFileChange} disabled={loadingSkp}/>
        {skpFileName && <span> File: {skpFileName}</span>}
        <button onClick={handleAnalyzeSkp} disabled={loadingSkp || !selectedSkp} style={{marginTop: '15px'}}>
          {loadingSkp ? 'Menganalisis SKP...' : 'Analisis Dokumen Kinerja'}
        </button>
        {skpResult && (
          <div className="result-box"> 
            <h4>Hasil Analisis Kinerja (dari AI):</h4>
            <AiOutput text={skpResult} />
            {finalPerformanceScore !== null && (
              <p style={{ marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)', borderTop: '1px solid var(--color-border)', paddingTop: '15px' }}>
                SKOR KINERJA FINAL (Estimasi AI): {finalPerformanceScore} / 100
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Selayar;