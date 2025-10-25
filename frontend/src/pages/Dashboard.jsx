import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, FileText, Users, TrendingUp, Target, Activity, Network } from 'lucide-react'; // Tambah ikon modul
import { API_URL, useAppContext } from '../App';

// --- Simulasi Data ---
const getCurrentUser = () => ({ name: 'Admin BKN' }); // Dummy user
const getDummyAssessments = () => [
  { id: '1', name: 'Anya Geraldine', position: 'Analis Kebijakan', scores: { overall: 92 }, recommendation: 'Direkomendasikan' },
  { id: '2', name: 'Budi Santoso', position: 'Pranata Komputer', scores: { overall: 78 }, recommendation: 'Butuh Pengembangan' },
  { id: '3', name: 'Citra Lestari', position: 'Analis SDM', scores: { overall: 88 }, recommendation: 'Direkomendasikan' },
];
// --------------------

export default function DashboardPage() {
  const [user, setUser] = useState(getCurrentUser());
  const [assessments, setAssessments] = useState([]); 
  const navigate = useNavigate();

  useEffect(() => {
    // Di aplikasi nyata, Anda mungkin fetch data user & assessments di sini
    setAssessments(getDummyAssessments()); 
  }, []);

  const stats = [
    { label: "Total Penilaian", value: assessments.length, icon: FileText, color: "text-primary" },
    { label: "Direkomendasikan", value: assessments.filter(a => a.recommendation === "Direkomendasikan").length, icon: TrendingUp, color: "text-success" },
    { label: "Butuh Pengembangan", value: assessments.filter(a => a.recommendation === "Butuh Pengembangan").length, icon: Users, color: "text-warning" },
    { label: "Rata-rata Skor", value: assessments.length > 0 ? Math.round(assessments.reduce((sum, a) => sum + (a.scores?.overall || 0), 0) / assessments.length) : 0, icon: BarChart3, color: "text-accent" },
  ];

  const quickActions = [
    { title: "LENTERA", desc: "Mulai penilaian kandidat", href: "/lentera", color: "from-blue-500 to-cyan-500", icon: Target },
    { title: "SELAYAR", desc: "Audit kinerja pegawai", href: "/selayar", color: "from-emerald-500 to-teal-500", icon: Activity },
    { title: "NAKHODA", desc: "Simulasi penempatan", href: "/nakhoda", color: "from-purple-500 to-pink-500", icon: Network },
  ];

  return (
    <section className="animate-fade-in"> 
        <div className="dashboard-header mb-12">
          <h1>Dashboard NAVIGARA</h1>
          <p>Selamat datang, {user.name}! Pantau aktivitas asesmen dan kinerja.</p>
        </div>

        <div className="stats-grid">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="stat-card glass animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                   <Icon className={`w-6 h-6 ${stat.color}`} /> {/* Terapkan warna ikon */}
                </div>
                <p className="label">{stat.label}</p>
                <p className="value">{stat.value}</p>
              </div>
            )
          })}
        </div>

        <div className="quick-actions mb-12">
          <h2>Akses Cepat Modul</h2>
          <div className="quick-actions-grid">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <Link key={i} to={action.href} style={{ textDecoration: 'none' }}> 
                  <div className="action-card glass animate-fade-in" style={{ animationDelay: `${(i + stats.length) * 0.1}s` }}>
                    <div 
                      className="icon-bg" 
                      style={{ background: `linear-gradient(to bottom right, var(--color-primary), var(--color-accent))`}} // Sesuaikan gradient jika perlu
                    >
                       <Icon size={24} strokeWidth={2.5} />
                    </div>
                    <h3>{action.title}</h3>
                    <p>{action.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {assessments.length > 0 && (
          <div className="recent-assessments glass animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <h2>Penilaian Terbaru (Contoh)</h2>
            <div className="space-y-4"> {/* Helper class untuk spacing */}
              {assessments.map((assessment, i) => (
                <div key={i} className="assessment-item">
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                    <div>
                      <p className="name">{assessment.name}</p>
                      <p className="position">{assessment.position}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="score">{assessment.scores?.overall}%</p>
                      <p className={`recommendation ${assessment.recommendation === "Direkomendasikan" ? "text-success" : "text-warning"}`}>
                        {assessment.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </section>
  );
}