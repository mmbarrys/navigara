import React from 'react';
import AiOutput from './AiOutput'; 
import ScoreBar from './ScoreBar';
import { Download, ChevronsRight, AlertTriangle, CheckCircle, BrainCircuit, SearchCheck, ShieldCheck } from 'lucide-react';

const ProfileCardLentera = ({ profileData, onExportPdf, loading }) => {
  
  // --- TAMBAH LOG & NULL CHECK ---
  console.log("Rendering ProfileCardLentera with data:", profileData); 
  
  // Tampilkan loading atau pesan jika data belum siap
  if (loading) return <div className="result-box"><p>Memuat hasil penilaian...</p></div>;
  if (!profileData || !profileData.grading_result) {
    // Ini seharusnya tidak terjadi jika dipanggil dari Lentera.jsx step 3, tapi jaga-jaga
    console.error("ProfileCardLentera dipanggil tanpa data yang valid!");
    return <div className="result-box error-box"><p>Error: Data profil tidak lengkap untuk ditampilkan.</p></div>;
  }
  // -----------------------------

  // Ekstrak data (gunakan default jika parsing gagal atau field tidak ada)
  const nama = profileData.candidateName || 'Kandidat';
  const jabatan = profileData.jabatan || 'Tidak Disebutkan'; // Ambil dari backend jika ada
  const skorTotal = profileData.skor_potensi ?? 0;
  // Pastikan scores_structured adalah objek
  const scores = (typeof profileData.scores_structured === 'object' && profileData.scores_structured !== null) 
                 ? profileData.scores_structured 
                 : {}; 
  const recommendation = profileData.recommendation || 'N/A';
  const markdownText = profileData.grading_result || '';

  // Tentukan warna & ikon rekomendasi
  let recColor = 'var(--color-muted-foreground)';
  let RecIcon = ChevronsRight;
  const lowerRec = recommendation.toLowerCase();
  if (lowerRec.includes('sangat') || lowerRec.includes('direkomendasikan')) { recColor = 'var(--color-success)'; RecIcon = CheckCircle; } 
  else if (lowerRec.includes('dipertimbangkan')) { recColor = 'var(--color-warning)'; RecIcon = AlertTriangle; } 
  else if (lowerRec.includes('butuh pengembangan')) { recColor = 'var(--color-error)'; RecIcon = AlertTriangle; }
  
  // Ambil teks analisis dari Markdown (Contoh sederhana, bisa diperbaiki)
  const getSectionText = (startMarker, endMarker) => {
      try {
        const startIndex = markdownText.toLowerCase().indexOf(startMarker.toLowerCase());
        const endIndex = markdownText.toLowerCase().indexOf(endMarker.toLowerCase(), startIndex);
        if (startIndex === -1 || endIndex === -1) return "Analisis tidak ditemukan.";
        // Ambil teks di antaranya, bersihkan marker & whitespace
        return markdownText.substring(startIndex + startMarker.length, endIndex).replace(/^\s*[\n\r]+/,'').replace(/[\n\r]+\s*$/,'');
      } catch { return "Error parsing analisis."}
  }

  const analisisKualifikasi = getSectionText("1. Analisis Kualifikasi (CV vs Jabatan):", "2. Analisis Studi Kasus");
  const analisisStudiKasus = getSectionText("2. Analisis Studi Kasus (Jawaban vs Soal):", "3. Analisis Jejak Digital");
  const analisisOSINT = getSectionText("3. Analisis Jejak Digital (OSINT):", "4. SKOR POTENSI");
  const catatanAsesor = getSectionText("Catatan Asesor AI:", "Saran Pengembangan");
  const saranPengembangan = getSectionText("Saran Pengembangan", "*Disclaimer:");


  return (
    <div className="profile-card-container animate-fade-in">
      {/* Tombol Export */}
       <button onClick={onExportPdf} disabled={loading} className="export-pdf-button">
          <Download size={18} /> Export PDF
       </button>
       
      {/* Header Kartu */}
      <div className="profile-card-header">
        <div className="profile-avatar">👤</div> {/* Placeholder Avatar */}
        <div className="profile-header-text">
          <h2>{nama}</h2>
          <p>{jabatan}</p>
        </div>
        <div className="profile-score-total" style={{ borderColor: recColor }}>
          <span>Skor Potensi</span>
          <strong>{skorTotal}</strong>
          <span>/ 100</span>
        </div>
      </div>

      {/* Badan Kartu - Skor Atribut */}
      <div className="profile-card-body">
         <h3>📊 Skor Atribut (Skala 1-7):</h3>
         <div className="score-bars-grid">
            <ScoreBar score={scores.kualifikasi ?? 0} label="Kualifikasi (CV)" delay={0.1} />
            <ScoreBar score={scores.nalar ?? 0} label="Nalar & Logika" delay={0.2}/>
            <ScoreBar score={scores.problem ?? 0} label="Problem Solving" delay={0.3}/>
            <ScoreBar score={scores.osint ?? 0} label="Jejak Digital" delay={0.4}/>
            <ScoreBar score={scores.integritas ?? 0} label="Potensi Integritas" delay={0.5}/>
         </div>

         {/* Badan Kartu - Analisis Teks */}
         <div className="profile-analysis-section">
            <details open> {/* Default terbuka */}
               <summary><h3><BrainCircuit size={18}/> Analisis Kualifikasi (CV)</h3></summary>
               <AiOutput text={analisisKualifikasi} />
            </details>
             <details>
               <summary><h3><BrainCircuit size={18}/> Analisis Studi Kasus</h3></summary>
               <AiOutput text={analisisStudiKasus} />
            </details>
             <details>
               <summary><h3><SearchCheck size={18}/> Analisis Jejak Digital (OSINT)</h3></summary>
               <AiOutput text={analisisOSINT} />
            </details>
         </div>
         
         {/* Rekomendasi & Pengembangan */}
          <div className="profile-recommendation-section">
             <h3><RecIcon size={20} style={{ color: recColor, marginRight: '8px' }}/> Rekomendasi Kelayakan: <span style={{ color: recColor }}>{recommendation}</span></h3>
             <AiOutput text={`**Catatan AI:** ${catatanAsesor}`} />
             {saranPengembangan && saranPengembangan.toLowerCase() !== "tidak diperlukan." && (
                 <AiOutput text={`**Saran Pengembangan:** ${saranPengembangan}`} />
             )}
         </div>
      </div>
    </div>
  );
};

export default ProfileCardLentera;