import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput'; 
import ProfileCardLentera from '../components/ProfileCardLentera'; 
import { Download } from 'lucide-react';

function Lentera() {
  const { setCandidateScores } = useAppContext(); 
  
  const [provider, setProvider] = useState('gemini');
  const [jabatan, setJabatan] = useState('Analis Kebijakan Ahli Madya');
  const [selectedCV, setSelectedCV] = useState(null);
  const [cvFileName, setCvFileName] = useState('');
  
  const [step, setStep] = useState(1); 
  
  const [caseStudy, setCaseStudy] = useState('');
  const [cvTextCache, setCvTextCache] = useState('');
  const [answerInputType, setAnswerInputType] = useState('text'); 
  const [caseStudyAnswerText, setCaseStudyAnswerText] = useState(''); // Hanya untuk textarea
  const [selectedAnswerFile, setSelectedAnswerFile] = useState(null);
  const [answerFileName, setAnswerFileName] = useState('');
  
  // State tunggal untuk hasil akhir
  const [finalResult, setFinalResult] = useState(null); // { grading_result, skor_potensi, scores_structured, recommendation, candidateName }
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDebug, setShowDebug] = useState(true); // Biarkan true untuk testing

  // Fungsi handleFileChange (Sudah benar)
  const handleFileChange = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (type === 'cv') {
        setSelectedCV(file); setCvFileName(file.name);
        setStep(1); setCaseStudy(''); setFinalResult(null); setError(''); 
      } else if (type === 'answer') {
        setSelectedAnswerFile(file); setAnswerFileName(file.name);
        setCaseStudyAnswerText(''); // Kosongkan textarea
        setError(''); 
      }
    } else { 
       if (type === 'cv') { setSelectedCV(null); setCvFileName(''); }
       else if (type === 'answer') { setSelectedAnswerFile(null); setAnswerFileName(''); }
    }
  };

  // Fungsi skipToResult (Perbaiki struktur data dummy)
  const skipToResult = () => {
      setError('');
      setStep(3);
      const dummyGradingResult = `## 👤 PROFIL POTENSI LENTERA (DEBUG)\n\n**Nama Kandidat:** Kandidat Debug\n**Jabatan Dituju:** ${jabatan}\n**Tanggal Asesmen:** ${new Date().toISOString().split('T')[0]}\n\n---\n### 📊 SKOR ATRIBUT (Skala 1-7):\n* **🧠 Kualifikasi & Pengetahuan (CV):** 5 / 7\n    * *Justifikasi:* Pengalaman relevan 3 tahun.\n* **💡 Nalar & Logika (Jawaban):** 6 / 7\n    * *Justifikasi:* Jawaban terstruktur dan logis.\n* **🔧 Problem Solving (Jawaban):** 5 / 7\n    * *Justifikasi:* Solusi cukup baik, bisa lebih inovatif.\n* **🌐 Jejak Digital (OSINT):** 4 / 7\n    * *Justifikasi:* Tidak ada temuan negatif signifikan.\n* **🛡️ Potensi Integritas (Jawaban):** 6 / 7\n    * *Justifikasi:* Menunjukkan pertimbangan etika.\n\n---\n### 📈 REKOMENDASI & PENGEMBANGAN:\n**Rekomendasi Kelayakan:** **Direkomendasikan**\n\n**Catatan Asesor AI:** Potensi baik secara keseluruhan, nalar kuat.\n\n**Saran Pengembangan:** Tidak diperlukan.\n\n---\n*Disclaimer: Hasil asesmen ini adalah estimasi AI berdasarkan data yang diberikan.*\n---`;
      const dummyScoresStructured = { kualifikasi: 5, nalar: 6, problem: 5, osint: 4, integritas: 6 };
      const dummySkorPotensi = 77; // (( (5+6+5+4+6)/5 - 1) / 6 ) * 100 
      const dummyRecommendation = 'Direkomendasikan';
      const dummyCandidateName = 'Kandidat Debug';

      setFinalResult({
          grading_result: dummyGradingResult,
          skor_potensi: dummySkorPotensi,
          scores_structured: dummyScoresStructured,
          recommendation: dummyRecommendation,
          candidateName: dummyCandidateName
      });
      // Update context juga
      setCandidateScores(prev => ({ ...prev, skor_potensi: dummySkorPotensi, nama: `${dummyCandidateName} (${jabatan})` }));
  };

  const handleGenerateCase = async () => {
    if (!jabatan) { setError('Error: Harap isi Jabatan yang Dituju.'); return; }
    setLoading(true); setError(''); setCaseStudy(''); setCvTextCache(''); setFinalResult(null); // Reset hasil
    const formData = new FormData();
    if (selectedCV) { formData.append('file_cv', selectedCV); }
    formData.append('jabatan', jabatan);
    formData.append('provider', provider);
    try {
      const response = await axios.post(`${API_URL}/api/lentera/generate-case`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, });
      setCaseStudy(response.data.case_study);
      setCvTextCache(response.data.cv_text_cache || ''); 
      setStep(2);
    } catch (err) { setError(`Error Tahap 1: ${err.response?.data?.error || "Gagal membuat studi kasus."}`); }
    setLoading(false);
  };

  const handleGradeFinal = async () => {
    if (answerInputType === 'text' && !caseStudyAnswerText) { setError('Error: Harap isi jawaban studi kasus.'); return; }
    if (answerInputType === 'file' && !selectedAnswerFile) { setError('Error: Harap pilih file jawaban.'); return; }
    setLoading(true); setError(''); setFinalResult(null); 

    const formData = new FormData();
    formData.append('provider', provider);
    formData.append('jabatan', jabatan);
    formData.append('cv_text_cache', cvTextCache); 
    formData.append('case_study', caseStudy); 

    if (answerInputType === 'file') {
        formData.append('file_answer', selectedAnswerFile);
    } else {
         //const answerBlob = new Blob([caseStudyAnswerText], { type: 'text/plain' });
         //formData.append('file_answer', answerBlob, 'jawaban_kandidat.txt');
         formData.append('answer_text', caseStudyAnswerText);
    }
    try {
      const response = await axios.post(`${API_URL}/api/lentera/grade-final`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, });
      const nameMatch = response.data.grading_result.match(/Nama Kandidat:\s*(.+)/i);
      const extractedName = nameMatch ? nameMatch[1].trim() : 'Kandidat';
      // Simpan semua hasil ke state finalResult
      setFinalResult({
          grading_result: response.data.grading_result,
          skor_potensi: response.data.skor_potensi,
          scores_structured: response.data.scores_structured,
          recommendation: response.data.recommendation,
          candidateName: extractedName 
      });
      // Perbaiki update context
      setCandidateScores(prev => ({ 
          ...prev, 
          skor_potensi: response.data.skor_potensi, // Gunakan response data
          nama: extractedName || `Kandidat (${jabatan})` 
      }));
      setStep(3);
    } catch (err) { setError(`Error Tahap 2: ${err.response?.data?.error || "Gagal menilai kandidat."}`); }
    setLoading(false);
  };

  // --- FUNGSI EXPORT PDF ---
   const handleExportPdf = async () => {
        // Pastikan ada data hasil sebelum mencoba ekspor
        if (!finalResult || !finalResult.grading_result) {
            setError("Tidak ada data profil untuk diekspor."); // Beri tahu user
            return; 
        }
        setLoading(true); // Aktifkan loading
        setError(''); // Hapus error sebelumnya
        try {
            // Panggil endpoint backend /api/lentera/export-pdf
            const response = await axios.post(`${API_URL}/api/lentera/export-pdf`,
                { 
                    profile_markdown: finalResult.grading_result, // Kirim teks Markdown dari hasil
                    nama_kandidat: finalResult.candidateName // Kirim nama kandidat untuk nama file
                },
                { responseType: 'blob' } // Minta respons sebagai file biner (blob)
            );

            // Buat URL sementara dari blob data PDF yang diterima
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            // Buat elemen link virtual
            const link = document.createElement('a');
            link.href = url;
            
            // Ambil nama file dari header 'Content-Disposition' jika ada,
            // Jika tidak, buat nama file default
            const contentDisposition = response.headers['content-disposition']; 
            let filename = `Profil_Lentera_${(finalResult.candidateName || 'Kandidat').replace(/\s+/g, '_')}.pdf`; // Nama default
            if (contentDisposition) { 
                const filenameMatch = contentDisposition.match(/filename="(.+)"/); 
                if (filenameMatch && filenameMatch.length > 1) {
                    filename = filenameMatch[1]; // Gunakan nama file dari header
                }
            }
            link.setAttribute('download', filename); // Set nama file download
            
            // Tambahkan link ke body, klik, lalu hapus
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url); // Hapus URL blob

        } catch (err) {
            // Tangani error jika gagal ekspor
            console.error("Export PDF Error:", err); // Log error detail
            setError(`Error Ekspor PDF: ${err.response?.data?.error || err.message || "Gagal menghubungi server."}`);
        }
        setLoading(false); // Matikan loading
    };
  // --- AKHIR FUNGSI EXPORT PDF ---

  // Fungsi resetAll (Sudah benar)
  // Perbaiki resetAll
  const resetAll = () => { 
    setProvider('gemini');
    setJabatan('Analis Kebijakan Ahli Madya');
    setSelectedCV(null);
    setCvFileName('');
    setStep(1);
    setCaseStudy('');
    setCvTextCache('');
    setCaseStudyAnswerText(''); // Reset jawaban teks
    setSelectedAnswerFile(null); // Reset file jawaban
    setAnswerFileName('');      // Reset nama file jawaban
    setAnswerInputType('text'); // Reset tipe input jawaban
    setFinalResult(null);       // Reset hasil akhir
    setLoading(false);
    setError('');
  };
  
  return (
    <div className="module-container">
      <h2>Modul LENTERA - Asesmen Talenta Adaptif</h2>
      {/* Tombol Reset & Debug */}
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
         {showDebug && ( <button onClick={skipToResult} className="debug-button"> Skip ke Hasil (Debug) </button> )}
         <button onClick={resetAll} className="reset-button">Reset Form</button>
      </div>
      
      {/* AI Provider Selector */}
      <div className="ai-selector card"> {/* Bungkus dalam card */}
        <label>Pilih AI Provider: </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loading}>
          <option value="gemini">Google Gemini</option>
          <option value="byteplus">Byteplus ARK</option>
        </select>
        <span> (Digunakan untuk Generate Soal & Penilaian) </span>
      </div>

      {error && <div className="result-box error-box"><h4>Error:</h4><p>{error}</p></div>}

      {/* --- TAHAP 1 --- */}
      <div className={`card card-step ${step === 1 ? 'active' : ''}`}>
         <h3>Tahap 1: Input Data & Generate Soal</h3>
         <label htmlFor="jabatanInput">Jabatan yang Dituju:</label>
         <input id="jabatanInput" type="text" value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Cth: Analis Kebijakan Ahli Madya" disabled={loading || step > 1}/>
         
         <label htmlFor="cvUpload">Upload CV Kandidat (PDF/TXT/DOCX/DOC) - Opsional:</label>
         <div className="file-input-wrapper">
             <input id="cvUpload" type="file" accept=".pdf,.txt,.docx,.doc" onChange={(e) => handleFileChange(e, 'cv')} disabled={loading || step > 1}/> 
             {cvFileName && <span className="file-name-display"> File: {cvFileName}</span>}
         </div>

         <button onClick={handleGenerateCase} disabled={loading || step > 1 || !jabatan} style={{marginTop: '15px', width: '100%'}}>
           {loading && step === 1 ? 'Membuat Soal...' : 'Lanjut ke Tahap 2: Buat Soal Kasus'}
         </button>
         
         {/* Tampilkan soal HANYA jika sudah generate dan belum di step 1 */}
         {caseStudy && step > 1 && ( 
           <div className="result-box study-case-box"> 
              <h4>Studi Kasus (Dibuat oleh AI):</h4>
              <AiOutput text={caseStudy} /> 
           </div> 
         )}
      </div>

      {/* --- TAHAP 2 --- */}
      <div className={`card card-step ${step === 2 ? 'active' : ''}`} style={{ opacity: step >= 2 ? 1 : 0.4 }}>
        <h3>Tahap 2: Jawab Studi Kasus</h3>
        <label>Pilih Metode Input Jawaban:</label>
        <div className="radio-group">
            <label> <input type="radio" name="answerType" value="text" checked={answerInputType === 'text'} onChange={() => setAnswerInputType('text')} disabled={loading || step !== 2}/> Tulis Jawaban </label>
            <label> <input type="radio" name="answerType" value="file" checked={answerInputType === 'file'} onChange={() => setAnswerInputType('file')} disabled={loading || step !== 2}/> Upload File </label>
        </div>
        {answerInputType === 'text' ? (
            <textarea placeholder={step < 2 ? "Selesaikan Tahap 1..." : "Tulis jawaban..."} value={caseStudyAnswerText} onChange={(e) => setCaseStudyAnswerText(e.target.value)} disabled={loading || step !== 2} />
        ) : (
            <div className="file-input-wrapper">
              <label htmlFor="answerUpload">Upload File Jawaban (PDF/TXT/DOCX/DOC):</label>
              <input id="answerUpload" type="file" accept=".pdf,.txt,.docx,.doc" onChange={(e) => handleFileChange(e, 'answer')} disabled={loading || step !== 2}/> 
              {answerFileName && <span className="file-name-display"> File: {answerFileName}</span>}
            </div>
        )}
        <button onClick={handleGradeFinal} disabled={loading || step !== 2 || (answerInputType === 'text' && !caseStudyAnswerText) || (answerInputType === 'file' && !selectedAnswerFile)} style={{ width: '100%', marginTop: '15px'}}>
          {loading && step === 2 ? 'Menganalisis...' : 'Lanjut ke Tahap 3: Dapatkan Penilaian'}
        </button>
      </div>

      {/* --- TAHAP 3 --- */}
      <div className={`card card-step ${step === 3 ? 'active' : ''}`} style={{ opacity: step === 3 ? 1 : 0.4 }}>
        <h3>Tahap 3: Hasil Penilaian</h3>
        {loading && step === 3 && <p className="loading-text">Memproses hasil penilaian AI...</p>}
        {step === 3 && finalResult && (
          <ProfileCardLentera 
             profileData={finalResult} 
             onExportPdf={handleExportPdf}
             loading={loading} // Kirim status loading ke card
          />
        )}
         {step < 3 && <p className="placeholder-text">Hasil penilaian akan muncul di sini setelah Tahap 2 selesai.</p>}
      </div>
    </div>
  );
}
export default Lentera;