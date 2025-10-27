import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';
import ProfileCardSelayar from '../components/ProfileCardSelayar'; // <-- Pastikan ini diimpor
import { Download } from 'lucide-react';

function Selayar() {
  const { setCandidateScores } = useAppContext(); 
  
  const [provider, setProvider] = useState('byteplus');
  
  // State untuk OSINT
  const [program, setProgram] = useState('Digitalisasi Layanan Pertanahan');
  const [sentimentResult, setSentimentResult] = useState(null); 
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  
  // State untuk Analisis SKP
  const [skpAnalysisResult, setSkpAnalysisResult] = useState(null); 
  const [selectedSkp, setSelectedSkp] = useState(null);
  const [skpFileName, setSkpFileName] = useState('');
  const [loadingSkp, setLoadingSkp] = useState(false);
  
  const [error, setError] = useState(''); 

  // Fungsi 1: Analisis Sentimen (OSINT)
  const handleAnalyzeSentiment = async () => {
    setLoadingSentiment(true); setSentimentResult(null); setError('');
    try {
      console.log(`Sending OSINT request for: ${program}, provider: ${provider}`); // Log Frontend
      const response = await axios.post(`${API_URL}/api/selayar/osint-sentiment`, { program, provider });
      console.log("OSINT Response Data:", response.data); // Log Frontend
      setSentimentResult(response.data); 
    } catch (err) { 
       console.error("OSINT Error:", err.response || err); // Log Frontend Error
       setError(`Error OSINT: ${err.response?.data?.message || err.response?.data?.error || err.message || "Gagal menghubungi server."}`); 
    }
    setLoadingSentiment(false);
  };
  
  // Fungsi 2: Handler perubahan file SKP
  const handleFileChange = (event) => {
    const file = event.target.files[0];
     if (file) {
        setSelectedSkp(file);
        setSkpFileName(file.name);
        setSkpAnalysisResult(null); // Reset hasil
        setError('');
     } else {
        setSelectedSkp(null);
        setSkpFileName('');
     }
  };

  // Fungsi 3: Analisis SKP (Upload File)
  const handleAnalyzeSkp = async () => {
    if (!selectedSkp) { setError('Error: Silakan pilih file SKP (PDF/TXT/DOCX/DOC) terlebih dahulu.'); return; }
    setLoadingSkp(true); setSkpAnalysisResult(null); setError('');
    const formData = new FormData();
    formData.append('file_skp', selectedSkp); // Nama field harus 'file_skp'
    formData.append('provider', provider);
    try {
      console.log(`Sending SKP analysis request for: ${skpFileName}, provider: ${provider}`); // Log Frontend
      const response = await axios.post(`${API_URL}/api/selayar/analyze-skp`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, });
      console.log("SKP Analysis Response Data:", response.data); // Log Frontend
      // Simpan semua data hasil ke state
      setSkpAnalysisResult({
          artifact_analysis: response.data.artifact_analysis,
          skor_kinerja: response.data.skor_kinerja,
          scores_structured: response.data.scores_structured,
          fileName: skpFileName // Sertakan nama file
      });
      // Update skor kinerja di context global
      setCandidateScores(prev => ({ ...prev, skor_kinerja: response.data.skor_kinerja }));
    } catch (err) { 
        console.error("SKP Analysis Error:", err.response || err); // Log Frontend Error
        // Cek jika error dari AI (ada artifact_analysis berisi Error:)
        if (err.response?.data?.artifact_analysis && err.response.data.artifact_analysis.startsWith("Error:")) {
             setSkpAnalysisResult({ artifact_analysis: err.response.data.artifact_analysis, skor_kinerja: 0, scores_structured: {}, fileName: skpFileName});
        } else {
            setError(`Error Analisis SKP: ${err.response?.data?.error || err.message || "Gagal menghubungi server."}`); 
        }
    }
    setLoadingSkp(false);
  };
  
  // Fungsi 4: Export PDF Hasil Analisis SKP
  const handleExportSkpPdf = async () => {
        if (!skpAnalysisResult || !skpAnalysisResult.artifact_analysis) return;
        setLoading(true); // Bisa pakai state loadingSkp
        setError('');
        try {
            console.log("Sending PDF export request for SKP:", skpAnalysisResult.fileName); // Log Frontend
            const response = await axios.post(`${API_URL}/api/selayar/export-pdf`,
                { 
                    profile_markdown: skpAnalysisResult.artifact_analysis, 
                    nama_file_skp: skpAnalysisResult.fileName 
                },
                { responseType: 'blob' } 
            );
            // Kode download (sama seperti Lentera)
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })); const link = document.createElement('a'); link.href = url;
            const contentDisposition = response.headers['content-disposition']; 
            let filename = `Analisis_Selayar_${(skpAnalysisResult.fileName || 'Pegawai').replace(/[\.](pdf|txt|docx|doc)$/,'')}.pdf`; 
            if (contentDisposition) { const filenameMatch = contentDisposition.match(/filename="(.+)"/); if (filenameMatch?.[1]) filename = filenameMatch[1]; }
            link.setAttribute('download', filename); document.body.appendChild(link); link.click(); link.parentNode.removeChild(link); window.URL.revokeObjectURL(url);
            console.log("PDF SKP downloaded successfully."); // Log Frontend
        } catch (err) { 
            console.error("PDF Export Error:", err.response || err); // Log Frontend Error
            setError(`Error Ekspor PDF SKP: ${err.response?.data?.error || err.message || "Gagal."}`); 
        }
        setLoading(false); // Matikan loadingSkp
    };

  return (
    <div className="module-container">
      <h2>Modul SELAYAR - Audit Kinerja & Dampak Publik</h2>
      
      {/* AI Provider Selector */}
      <div className="ai-selector card">
        <label>Pilih AI Provider: </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loadingSentiment || loadingSkp}>
          <option value="gemini">Google Gemini</option>
          <option value="byteplus">Byteplus ARK</option>
        </select>
        <span> (Digunakan untuk Analisis Sentimen & SKP) </span>
      </div>

      {error && <div className="result-box error-box"><h4>Error:</h4><p>{error}</p></div>}

      {/* Bagian 1: Analisis Sentimen Publik (OSINT) */}
      <div className="card" style={{ marginBottom: '25px' }}> 
        <h3>1. Analisis Dampak Publik (OSINT via Google Search)</h3>
        <label htmlFor="programKerjaInput">Program Kerja / Kata Kunci:</label>
        <input 
          id="programKerjaInput" type="text" value={program} 
          onChange={(e) => setProgram(e.target.value)} 
          placeholder="Cth: Digitalisasi Layanan Pertanahan" disabled={loadingSentiment}/>
        <button onClick={handleAnalyzeSentiment} disabled={loadingSentiment} style={{width: '100%', marginTop: '5px'}}>
          {loadingSentiment ? 'Mencari & Menganalisis Berita...' : 'Jalankan OSINT & Analisis Sentimen'}
        </button>
        
        {/* Loading Indicator OSINT */}
        {loadingSentiment && (
            <div className="loading-indicator">
                <p>Menarik berita dari Google dan menganalisis sentimen<span>.</span><span>.</span><span>.</span></p>
            </div>
        )}

        {/* Hasil OSINT */}
        {!loadingSentiment && sentimentResult && (
          <div style={{ marginTop: '20px' }}>
            <div className="result-box"> 
              <strong>Ringkasan Sentimen (dari AI):</strong>
              <AiOutput text={sentimentResult.sentiment_analysis_text} /> 
            </div>
            
            <h4 style={{color: 'var(--color-primary)', marginTop: '20px'}}>Sumber Google Search Terkait:</h4>
            {sentimentResult.articles && sentimentResult.articles.length > 0 && !sentimentResult.articles[0].title.includes("Error") ? (
                <ul className="osint-list">
                  {sentimentResult.articles.map((article, index) => (
                    <li key={index} className="osint-item">
                      <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
                      <p>{article.snippet}</p>
                      <span>Sumber: {article.source}</span>
                    </li>
                  ))}
                </ul>
            ) : (
                <p className="placeholder-text" style={{marginTop:'10px'}}>{sentimentResult.articles?.[0]?.snippet || "Tidak ada artikel relevan ditemukan."}</p>
            )}
          </div>
        )}
        {/* Placeholder jika belum ada hasil & tidak loading */}
        {!loadingSentiment && !sentimentResult && (
            <p className="placeholder-text" style={{marginTop: '20px'}}>Hasil analisis sentimen publik akan muncul di sini.</p>
        )}
      </div>
      
      {/* Bagian 2: Analisis Kinerja Internal (Upload SKP) */}
      <div className="card">
        <h3>2. Analisis Kinerja Internal (Upload SKP)</h3>
        <label htmlFor="skpUpload">Upload Dokumen SKP / Laporan (PDF/TXT/DOCX/DOC):</label>
         <div className="file-input-wrapper">
             <input id="skpUpload" type="file" accept=".pdf,.txt,.docx,.doc" onChange={handleFileChange} disabled={loadingSkp}/>
             {skpFileName && <span className="file-name-display"> File: {skpFileName}</span>}
         </div>
        
        <button onClick={handleAnalyzeSkp} disabled={loadingSkp || !selectedSkp} style={{marginTop: '15px', width: '100%'}}>
          {loadingSkp ? 'Menganalisis SKP...' : 'Analisis Dokumen Kinerja'}
        </button>
        
        {/* Loading Indicator SKP */}
        {loadingSkp && (
            <div className="loading-indicator">
                <p>Sedang menganalisis dokumen kinerja<span>.</span><span>.</span><span>.</span></p>
            </div>
        )}

        {/* Tampilkan Profile Card jika hasil sudah ada & tidak loading */}
        {!loadingSkp && skpAnalysisResult && (
           <ProfileCardSelayar
              profileData={skpAnalysisResult}
              onExportPdf={handleExportSkpPdf}
              loading={loadingSkp} 
           />
        )}
         {/* Tampilkan placeholder jika belum ada hasil & tidak loading */}
         {!loadingSkp && !skpAnalysisResult && (
             <p className="placeholder-text" style={{marginTop: '20px'}}>Hasil analisis kinerja akan muncul di sini.</p>
         )}
      </div>
    </div>
  );
}
export default Selayar;