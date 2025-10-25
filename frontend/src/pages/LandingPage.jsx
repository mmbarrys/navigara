import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, Activity, Network, CheckCircle, Lock, BarChart, Sun } from 'lucide-react';

// Data Modul
const modules = [
  { id: "lentera", title: "LENTERA", subtitle: "Asesmen Kandidat", description: "Evaluasi potensi kandidat melalui CV analysis, studi kasus dinamis, dan OSINT", icon: Target, color: "from-blue-500 to-cyan-500", href: "/lentera", features: ["CV Upload", "AI Case Study", "Digital Footprint", "Potential Score"] },
  { id: "selayar", title: "SELAYAR", subtitle: "Audit Kinerja & Dampak", description: "Audit kinerja pegawai dengan analisis SKP dan sentimen publik", icon: Activity, color: "from-emerald-500 to-teal-500", href: "/selayar", features: ["SKP Upload", "Performance Score", "Public Sentiment", "Impact Analysis"] },
  { id: "nakhoda", title: "NAKHODA", subtitle: "Simulasi Penempatan", description: "Simulasi penempatan talenta dengan visualisasi struktur organisasi", icon: Network, color: "from-purple-500 to-pink-500", href: "/nakhoda", features: ["What-If Simulation", "Team Structure", "Effectiveness Score", "Comparison Report"] },
];

// Data Fitur
const features = [
  { icon: CheckCircle, title: "AI-Powered", desc: "Analisis berbasis kecerdasan buatan" },
  { icon: Lock, title: "Secure", desc: "Keamanan data tingkat enterprise" },
  { icon: BarChart, title: "Analytics", desc: "Dashboard analytics real-time" },
  { icon: Sun, title: "Modern UI", desc: "Interface yang nyaman dan intuitif" },
];


// --- PERUBAHAN UTAMA DI SINI ---
// Komponen LandingPage sekarang tidak perlu prop 'setAuth'
export default function LandingPage() { 
  const navigate = useNavigate(); // Gunakan hook navigate

  // Fungsi untuk mengarahkan ke halaman login
  const goToLoginPage = () => {
    navigate('/login');
  };
  // -----------------------------

  return (
    <main className="landing-page-main"> 
      
      <header className="landing-header glass">
         <img src="/Navigara.png" alt="NAVIGARA Logo" className="landing-logo" />
         <div>
            {/* Tombol ini sekarang mengarah ke /login */}
            <button onClick={goToLoginPage} className="button-primary">Masuk Sistem</button>
            {/* <button className="button-outline">Pelajari Lebih Lanjut</button> */}
         </div>
      </header>

      <section className="hero-section">
        <div className="hero-content animate-fade-in">
          <h1 className="hero-title gradient-text">NAVIGARA</h1>
          <h2 className="hero-subtitle">Navigasi Visi Aparatur Negara</h2>
          <p className="hero-description">
            Platform berbasis AI untuk asesmen, audit kinerja, dan simulasi penempatan talenta ASN yang transparan, objektif, dan prediktif.
          </p>
          <div className="hero-buttons">
             {/* Tombol ini juga mengarah ke /login */}
            <button onClick={goToLoginPage} className="button-primary button-lg">Masuk Sistem</button>
            {/* <button className="button-outline button-lg">Pelajari Lebih Lanjut</button> */}
          </div>
        </div>
        <div className="hero-bg-decoration">
          <div className="circle-blur circle-1 animate-pulse-glow"></div>
          <div className="circle-blur circle-2 animate-pulse-glow" style={{ animationDelay: "1s" }}></div>
        </div>
      </section>

      <section className="modules-section">
        <div className="section-header">
          <h2 className="section-title">Tiga Pilar Sistem NAVIGARA</h2>
          <p className="section-subtitle">Solusi komprehensif untuk siklus hidup manajemen talenta ASN.</p>
        </div>
        <div className="modules-grid">
          {modules.map((module, index) => (
            <div key={module.id} className="module-card-wrapper animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              {/* Komponen ModuleCard juga diupdate di bawah */}
              <ModuleCard module={module} /> 
            </div>
          ))}
        </div>
      </section>

      <section className="features-section">
         <div className="section-header">
           <h2 className="section-title">Fitur Unggulan</h2>
         </div>
         <div className="features-grid">
           {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
               <div key={i} className="feature-card glass animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                 <div className="feature-icon"><Icon size={32} /></div>
                 <h3 className="feature-title">{feature.title}</h3>
                 <p className="feature-description">{feature.desc}</p>
               </div>
              )
           })}
         </div>
      </section>

      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} NAVIGARA (Tim JangkarBesi). Hak Cipta Dilindungi.</p>
      </footer>
    </main>
  );
}

// Komponen ModuleCard
const ModuleCard = ({ module }) => {
  const Icon = module.icon;
  const navigate = useNavigate(); // Gunakan navigate di sini juga

  return (
    <div className="module-card glass">
      <div className={`module-icon-bg`} style={{ background: `linear-gradient(to bottom right, var(--color-primary), var(--color-accent))`}}>
         <Icon size={24} strokeWidth={2.5}/>
      </div>
      <h3 className="module-title gradient-text">{module.title}</h3>
      <p className="module-subtitle">{module.subtitle}</p>
      <p className="module-description">{module.description}</p>
      <ul className="module-features">
        {module.features.map((feature, i) => (
          <li key={i}>{feature}</li>
        ))}
      </ul>
       {/* Tombol ini juga mengarah ke /login */}
       <button onClick={() => navigate('/login')} className="button-primary" style={{width: '100%', marginTop: '15px'}}>Mulai Gunakan</button>
    </div>
  );
};