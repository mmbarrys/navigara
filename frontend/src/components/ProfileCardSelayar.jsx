import React from 'react';
import AiOutput from './AiOutput';
import ScoreBar from './ScoreBar';
import { Download, CheckCircle, AlertTriangle, ChevronsRight, Target, Users, Edit3 } from 'lucide-react'; // Ikon

const ProfileCardSelayar = ({ profileData, onExportPdf, loading }) => {
  if (!profileData || !profileData.artifact_analysis) {
    return <div className="result-box">Menunggu hasil analisis SKP...</div>;
  }

  // Ekstrak data
  const skorTotal = profileData.skor_kinerja ?? 0;
  const scores = profileData.scores_structured || {};
  const markdownText = profileData.artifact_analysis || '';
  const fileName = profileData.fileName || 'Dokumen Kinerja';

  // Tentukan warna utama berdasarkan skor total
  let scoreColor = 'var(--color-error)';
  if (skorTotal >= 80) scoreColor = 'var(--color-success)';
  else if (skorTotal >= 60) scoreColor = 'var(--color-warning)';

   // Ambil teks analisis dari Markdown (Contoh sederhana)
   const getSectionText = (startMarker, endMarker) => {
       try {
           const startIndex = markdownText.toLowerCase().indexOf(startMarker.toLowerCase());
           const endIndex = markdownText.toLowerCase().indexOf(endMarker.toLowerCase(), startIndex);
           if (startIndex === -1 || endIndex === -1) return "N/A";
           return markdownText.substring(startIndex + startMarker.length, endIndex).replace(/^\s*[\n\r]+/,'').replace(/[\n\r]+\s*$/,'');
       } catch { return "Error parsing."}
   }
   const ringkasanKontribusi = getSectionText("1. Ringkasan Kontribusi", "2. Analisis Pencapaian");
   const analisisTarget = getSectionText("2. Analisis Pencapaian Target:", "3. SKOR KINERJA");
   const catatanKekuatan = getSectionText("Kekuatan Utama:", "Area Pengembangan");
   const catatanArea = getSectionText("Area Pengembangan:", "Saran Pengembangan");
   const saranPengembangan = getSectionText("Saran Pengembangan:", "*Disclaimer:");


  return (
    <div className="profile-card-container animate-fade-in">
       {/* Tombol Export */}
       <button onClick={onExportPdf} disabled={loading} className="export-pdf-button">
          <Download size={18} /> Export PDF
       </button>
       
      {/* Header Kartu */}
      <div className="profile-card-header">
         <div className="profile-avatar">📋</div> {/* Ikon dokumen */}
        <div className="profile-header-text">
          <h2>Analisis Kinerja (SKP)</h2>
          <p>Sumber: {fileName}</p>
        </div>
        <div className="profile-score-total" style={{ borderColor: scoreColor }}>
          <span>Skor Kinerja</span>
          <strong>{skorTotal}</strong>
          <span>/ 100</span>
        </div>
      </div>

      {/* Badan Kartu - Skor Atribut */}
      <div className="profile-card-body">
         <h3>📊 Skor Atribut Kinerja (Skala 1-7):</h3>
         <div className="score-bars-grid">
            <ScoreBar score={scores.target ?? 0} label="Pencapaian Target" delay={0.1} />
            <ScoreBar score={scores.kontribusi ?? 0} label="Kontribusi & Inisiatif" delay={0.2}/>
            <ScoreBar score={scores.kualitas ?? 0} label="Kualitas Pelaporan" delay={0.3}/>
         </div>

         {/* Badan Kartu - Analisis Teks */}
         <div className="profile-analysis-section">
             <details open>
               <summary><h3><CheckCircle size={18}/> Ringkasan Kontribusi</h3></summary>
               <AiOutput text={ringkasanKontribusi} />
            </details>
             <details open>
               <summary><h3><Target size={18}/> Analisis Pencapaian Target</h3></summary>
               <AiOutput text={analisisTarget} />
            </details>
             <details>
               <summary><h3><Users size={18}/> Catatan Asesor AI</h3></summary>
               <AiOutput text={`**Kekuatan:** ${catatanKekuatan}\n\n**Area Pengembangan:** ${catatanArea}`} />
            </details>
             {saranPengembangan && saranPengembangan.toLowerCase() !== "tidak diperlukan." && (
                 <details>
                    <summary><h3><Edit3 size={18}/> Saran Pengembangan</h3></summary>
                    <AiOutput text={saranPengembangan} />
                 </details>
             )}
         </div>
      </div>
    </div>
  );
};

export default ProfileCardSelayar;