import React from 'react';
import AiOutput from './AiOutput';
import ScoreBar from './ScoreBar';
import { Download, CheckCircle, AlertTriangle, ChevronsRight, Target, Users, Edit3, Award, Zap, HeartHandshake, Shield, Sparkles, Brain } from 'lucide-react'; // Ikon Perilaku

// Map nama aspek ke ikon
const perilakuIcons = {
    pelayanan: HeartHandshake,
    akuntabel: Shield,
    kompeten: Brain,
    harmonis: Users,
    loyal: Award,
    adaptif: Zap,
    kolaboratif: Sparkles
};
// Map key dari backend ke label yang rapi
const perilakuLabels = {
    pelayanan: "Berorientasi Pelayanan",
    akuntabel: "Akuntabel",
    kompeten: "Kompeten",
    harmonis: "Harmonis",
    loyal: "Loyal",
    adaptif: "Adaptif",
    kolaboratif: "Kolaboratif"
};

// --- FUNGSI BARU: Parsing Teks (Khusus Frontend) ---
// Kita butuh ini agar bisa memecah output AI
const getSectionText = (markdownText, startMarker, endMarker) => {
   try {
       const startIndex = markdownText.toLowerCase().indexOf(startMarker.toLowerCase());
       if (startIndex === -1) return null; 
       
       let endIndex;
       if (endMarker) {
           endIndex = markdownText.toLowerCase().indexOf(endMarker.toLowerCase(), startIndex + startMarker.length);
           if (endIndex === -1) endIndex = markdownText.length; 
       } else {
           endIndex = markdownText.length; 
       }
       
       return markdownText.substring(startIndex + startMarker.length, endIndex)
                          .replace(/^\s*[\n\r]+/,'') // Hapus spasi/newline di awal
                          .replace(/[\n\r]+\s*$/,''); // Hapus spasi/newline di akhir
   } catch { return "Error parsing text section."}
}
// ----------------------------------------------------

const ProfileCardSelayar = ({ profileData, onExportPdf, loading }) => {
  if (loading) return <div className="loading-indicator"><p>Sedang memproses...</p></div>;
  if (!profileData || !profileData.artifact_analysis) {
    return <div className="result-box">Hasil analisis SKP akan muncul di sini.</div>;
  }
  
  if (profileData.artifact_analysis.startsWith("Error:")) {
      return <div className="result-box error-box"><AiOutput text={profileData.artifact_analysis} /></div>;
  }

  // Ekstrak data
  const skorTotal = profileData.skor_kinerja ?? 0;
  const scoresPerilaku = profileData.scores_structured || {}; // Ini sekarang objek skor 0-100
  const markdownText = profileData.artifact_analysis || '';
  const fileName = profileData.fileName || 'Dokumen Kinerja';

  // --- Parsing Teks di Frontend (Revisi) ---
  const analisisHasilKerja = getSectionText(markdownText, "### 🎯 ANALISIS HASIL KERJA (TARGET vs REALISASI):", "### ✨ ANALISIS PERILAKU KERJA");
  // (Skor perilaku sudah dalam 'scoresPerilaku')
  const catatanAsesor = getSectionText(markdownText, "### 💡 CATATAN & SARAN PENGEMBANGAN (AI):", "*Disclaimer:");
  const rekomendasiBlok = getSectionText(markdownText, "### 🏆 REKOMENDASI PREDIKAT KINERJA (Objektif):", "### 💡 CATATAN & SARAN PENGEMBANGAN (AI):");
  
  // Ekstrak Predikat dari blok rekomendasi
  const matchPredikat = rekomendasiBlok ? rekomendasiBlok.match(/\*\*(.*?)\*\*/) : null;
  const predikat = matchPredikat ? matchPredikat[1].trim() : "N/A";
  // ---------------------------------

  // Tentukan warna utama berdasarkan skor total
  let scoreColor = 'var(--color-error)';
  if (skorTotal > 90) { scoreColor = 'var(--color-success)'; }
  else if (skorTotal > 75) { scoreColor = 'var(--color-primary)'; }
  else if (skorTotal > 60) { scoreColor = 'var(--color-warning)'; }
  else if (skorTotal > 50) { scoreColor = 'var(--color-muted-foreground)'; }

  return (
    <div className="profile-card-container animate-fade-in">
       <button onClick={onExportPdf} disabled={loading} className="export-pdf-button">
          <Download size={18} /> Export PDF
       </button>
       
      <div className="profile-card-header">
         <div className="profile-avatar">📋</div> 
        <div className="profile-header-text">
          <h2>Analisis Objektif Kinerja</h2>
          <p>Sumber: {fileName}</p>
        </div>
        <div className="profile-score-total" style={{ borderColor: scoreColor }}>
          <span>Predikat AI</span>
          <strong style={{ fontSize: predikat.length > 10 ? '1rem' : '1.3rem' }}> 
              {predikat}
          </strong> 
          <span>(Skor: {skorTotal}/100)</span>
        </div>
      </div>

      <div className="profile-card-body">
         
         <details open className="profile-analysis-details">
            <summary><h3><Target size={18}/> Analisis Hasil Kerja (RHK)</h3></summary>
            {/* Tampilkan narasi analisis hasil kerja */}
            <AiOutput text={analisisHasilKerja || "Tidak ada analisis hasil kerja."} />
         </details>
      
         <details open className="profile-analysis-details">
            <summary><h3>✨ Analisis Perilaku Kerja (Skala 0-100)</h3></summary>
             <div className="score-bars-grid" style={{marginTop: '15px'}}> 
               {Object.entries(scoresPerilaku).map(([key, score], index) => {
                   const Icon = perilakuIcons[key] || CheckCircle; 
                   const label = perilakuLabels[key] || key;
                   return (
                       <div key={key} className="score-bar-item animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                          <div className="score-bar-label">
                             <span><Icon size={14} style={{ marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }}/>{label}</span>
                             <strong>{score}/100</strong>
                          </div>
                          {/* --- PERBAIKAN MAXSCORE --- */}
                          <ScoreBar score={score} maxScore={100} label="" delay={index * 0.05 + 0.1} /> 
                          {/* --------------------------- */}
                       </div>
                   )
               })}
            </div>
         </details>

         <details open className="profile-analysis-details">
            <summary><h3>📝 Catatan & Saran AI</h3></summary>
            <AiOutput text={catatanAsesor || "Tidak ada catatan."} />
         </details>
      </div>
    </div>
  );
};

export default ProfileCardSelayar;