import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';
import ProfileCardSelayar from '../components/ProfileCardSelayar'; // <-- IMPORT BARU
import { Download } from 'lucide-react'; // Ikon download

function Selayar() {
  const { setCandidateScores } = useAppContext();

  const [provider, setProvider] = useState('byteplus');
  const [program, setProgram] = useState('Digitalisasi Layanan Pertanahan');
  const [sentimentResult, setSentimentResult] = useState(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  const [skpAnalysisResult, setSkpAnalysisResult] = useState(null); // { artifact_analysis, skor_kinerja, scores_structured }
  const [skpResultText, setSkpResultText] = useState('');
  const [selectedSkp, setSelectedSkp] = useState(null);
  const [skpFileName, setSkpFileName] = useState('');
  const [finalPerformanceScore, setFinalPerformanceScore] = useState(null);
  const [loadingSkp, setLoadingSkp] = useState(false);
  const [error, setError] = useState('');
  const [loadingExport, setLoadingExport] = useState(false);

  // --- FUNGSI 1: Analisis Sentimen (OSINT) ---
  const handleAnalyzeSentiment = async () => {
    setLoadingSentiment(true);
    setSentimentResult(null);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/selayar/osint-sentiment`, {
        program,
        provider,
      });
      setSentimentResult(response.data);
    } catch (error) {
      setError(`Error OSINT: ${error.response?.data?.message || 'Gagal.'}`);
    }
    setLoadingSentiment(false);
  };

  // --- FUNGSI 2: Upload File SKP ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedSkp(file);
      setSkpFileName(file.name);
      setSkpResultText('');
      setFinalPerformanceScore(null);
      setError('');
    } else {
      setSelectedSkp(null);
      setSkpFileName('');
    }
  };

  // --- FUNGSI 3: Analisis SKP ---
  const handleAnalyzeSkp = async () => {
   if (!selectedSkp) { setError('Error: Pilih file SKP dulu.'); return; }
    setLoadingSkp(true); setSkpAnalysisResult(null); setError('');
    const formData = new FormData();
    formData.append('file_skp', selectedSkp);
    formData.append('provider', provider);
      try {
      const response = await axios.post(`${API_URL}/api/selayar/analyze-skp`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, });
      // Simpan semua data hasil ke state
      setSkpAnalysisResult({
          artifact_analysis: response.data.artifact_analysis,
          skor_kinerja: response.data.skor_kinerja,
          scores_structured: response.data.scores_structured,
          fileName: skpFileName // Sertakan nama file untuk profile card
      });
      setCandidateScores(prev => ({ ...prev, skor_kinerja: response.data.skor_kinerja }));
    } catch (error) { setError(`Error Analisis SKP: ${error.response?.data?.error || "Gagal."}`); }
    setLoadingSkp(false);
  };

  // --- FUNGSI 4: Export SKP ke PDF ---
  const handleExportSkpPdf = async () => {
    if (!skpAnalysisResult || !skpAnalysisResult.artifact_analysis) return;
        setLoading(true); // Gunakan state loadingSkp
        setError('');
        try {
            const response = await axios.post(`${API_URL}/api/selayar/export-pdf`,
                { 
                    profile_markdown: skpAnalysisResult.artifact_analysis, 
                    nama_file_skp: skpAnalysisResult.fileName 
                },
                { responseType: 'blob' } 
            );

      const url = window.URL.createObjectURL(new Blob([response.data])); 
      const link = document.createElement('a'); link.href = url;
      const contentDisposition = response.headers['content-disposition']; let filename = `Profil_Selayar_${(skpAnalysisResult.fileName || 'Pegawai').replace(/[\.](pdf|txt|docx|doc)$/,'')}.pdf`; 
            if (contentDisposition) { const filenameMatch = contentDisposition.match(/filename="(.+)"/); if (filenameMatch?.[1]) filename = filenameMatch[1]; }
            link.setAttribute('download', filename); document.body.appendChild(link); link.click(); link.parentNode.removeChild(link); window.URL.revokeObjectURL(url);
        } catch (err) { setError(`Error Ekspor PDF SKP: ${err.response?.data?.error || err.message || "Gagal."}`); }
        setLoading(false); // Matikan loadingSkp
    };

  return (
    <div className="module-container">
      <h2>Modul SELAYAR - Audit Kinerja & Dampak Publik</h2>

      {/* --- Pilihan Provider --- */}
      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 'var(--radius)',
        }}
      >
        <label>Pilih AI Provider: </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={loadingSentiment || loadingSkp}
        >
          <option value="gemini">Google Gemini</option>
          <option value="byteplus">Byteplus ARK</option>
        </select>
      </div>

      {error && (
        <div className="result-box error-box">
          <h4>Error:</h4>
          <p>{error}</p>
        </div>
      )}

      {/* --- BAGIAN 1: OSINT --- */}
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

            <h4 style={{ color: 'var(--color-primary)', marginTop: '20px' }}>
              Sumber Google Search:
            </h4>
            <ul className="osint-list">
              {sentimentResult.articles.map((article) => (
                <li key={article.url} className="osint-item">
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    {article.title}
                  </a>
                  <p>{article.snippet}</p>
                  <span>Sumber: {article.source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* --- BAGIAN 2: SKP --- */}
      <div className="card">
        <h3>2. Analisis Kinerja Internal (Upload SKP)</h3>
        <label>Upload Dokumen SKP / Laporan (PDF/TXT/DOCX/DOC):</label>
        <input type="file" accept=".pdf,.txt,.docx,.doc" onChange={handleFileChange} disabled={loadingSkp}/>
        {skpFileName && <span> File: {skpFileName}</span>}
        <button onClick={handleAnalyzeSkp} disabled={loadingSkp || !selectedSkp} style={{marginTop: '15px'}}>
          {loadingSkp ? 'Menganalisis SKP...' : 'Analisis Dokumen Kinerja'}
        </button>
        
        {/* Tampilkan Profile Card jika hasil sudah ada */}
        {skpAnalysisResult && (
           <ProfileCardSelayar
              profileData={skpAnalysisResult}
              onExportPdf={handleExportSkpPdf}
              loading={loadingSkp}
           />
        )}
      </div>
    </div>
  );
}

export default Selayar;