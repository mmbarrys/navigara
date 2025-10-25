import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';
import { Download } from 'lucide-react'; // Ikon download

function Selayar() {
  const { setCandidateScores } = useAppContext();

  const [provider, setProvider] = useState('byteplus');
  const [program, setProgram] = useState('Digitalisasi Layanan Pertanahan');
  const [sentimentResult, setSentimentResult] = useState(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

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
    if (!selectedSkp) {
      setError('Error: Pilih file SKP dulu.');
      return;
    }
    setLoadingSkp(true);
    setSkpResultText('');
    setFinalPerformanceScore(null);
    setError('');

    const formData = new FormData();
    formData.append('file_skp', selectedSkp);
    formData.append('provider', provider);

    try {
      const response = await axios.post(`${API_URL}/api/selayar/analyze-skp`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSkpResultText(response.data.artifact_analysis);
      const score = response.data.skor_kinerja;
      setFinalPerformanceScore(score);
      setCandidateScores((prev) => ({ ...prev, skor_kinerja: score }));
    } catch (error) {
      setError(`Error Analisis SKP: ${error.response?.data?.error || 'Gagal.'}`);
    }

    setLoadingSkp(false);
  };

  // --- FUNGSI 4: Export SKP ke PDF ---
  const handleExportSkpPdf = async () => {
    if (!skpResultText) return;
    setLoadingExport(true);
    setError('');

    try {
      // NOTE: Ganti endpoint jika sudah ada endpoint export PDF khusus untuk SELAYAR
      const response = await axios.post(
        `${API_URL}/api/lentera/export-pdf`,
        {
          profile_markdown: `# Profil Kinerja SELAYAR\n\n${skpResultText}`,
          nama_kandidat: skpFileName.replace('.pdf', '').replace('.txt', '') || 'Pegawai',
        },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `Profil_Selayar_${skpFileName.replace('.pdf', '').replace('.txt', '') || 'Pegawai'}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch?.[1]) filename = filenameMatch[1];
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Error Ekspor PDF SKP: ${err.response?.data?.error || err.message || 'Gagal.'}`);
    }
    setLoadingExport(false);
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
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Upload Dokumen SKP / Laporan (PDF/TXT):
        </label>
        <input type="file" accept=".pdf,.txt" onChange={handleFileChange} disabled={loadingSkp} />
        {skpFileName && <span> File: {skpFileName}</span>}

        <button
          onClick={handleAnalyzeSkp}
          disabled={loadingSkp || !selectedSkp}
          style={{ marginTop: '15px' }}
        >
          {loadingSkp ? 'Menganalisis SKP...' : 'Analisis Dokumen Kinerja'}
        </button>

        {skpResultText && (
          <>
            <button
              onClick={handleExportSkpPdf}
              disabled={loadingExport}
              style={{
                float: 'right',
                background: 'var(--color-success)',
                marginLeft: '10px',
                marginTop: '10px',
              }}
            >
              <Download size={18} style={{ marginRight: '5px' }} />{' '}
              {loadingExport ? 'Mengekspor...' : 'Export PDF'}
            </button>

            <div className="result-box" style={{ marginTop: '60px' }}>
              <AiOutput text={skpResultText} />
              {finalPerformanceScore !== null && (
                <p
                  style={{
                    marginTop: '20px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: 'var(--color-primary)',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '15px',
                  }}
                >
                  SKOR KINERJA FINAL (Estimasi AI): {finalPerformanceScore} / 100
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Selayar;