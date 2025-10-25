import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Lentera from './pages/Lentera';
import Selayar from './pages/Selayar';
import Nakhoda from './pages/Nakhoda';
import LandingPage from './pages/LandingPage'; // <-- IMPORT BARU
import { LayoutDashboard, Target, Activity, Network, User } from 'lucide-react';

//export const API_URL = 'http://localhost:5000';
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AppContext = createContext();
export function useAppContext() { return useContext(AppContext); }

function App() {
  const [auth, setAuth] = useState(localStorage.getItem('token'));
  const [candidateScores, setCandidateScores] = useState({
    id: `kandidat-${Date.now()}`,
    skor_potensi: null,
    skor_kinerja: null,
    nama: 'Kandidat (Belum Dinilai)'
  });

  // --- LOGIKA ROUTING BARU ---
  if (!auth) {
    // Jika belum login, tampilkan Landing Page atau Login
    return (
      <Routes>
        <Route path="/" element={<LandingPage setAuth={setAuth} />} /> {/* Landing Page di root */}
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        {/* Rute lain akan diarahkan ke landing page */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }
  // -------------------------

  // Jika SUDAH login, tampilkan aplikasi utama
  return (
    <AppContext.Provider value={{ candidateScores, setCandidateScores }}>
      <div className="app-layout">
        <Sidebar />
        <div className="main-wrapper">
          <Header setAuth={setAuth} />
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} /> {/* Dashboard jadi root setelah login */}
              <Route path="/lentera" element={<Lentera />} />
              <Route path="/selayar" element={<Selayar />} />
              <Route path="/nakhoda" element={<Nakhoda />} />
              {/* Jika sudah login akses /login atau /, arahkan ke dashboard */}
              <Route path="/login" element={<Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}

// === KOMPONEN HEADER (Sama seperti V7) ===
function Header({ setAuth }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const handleLogout = () => { setAuth(null); localStorage.removeItem('token'); navigate('/'); }; // Arahkan ke landing setelah logout
  useEffect(() => {
    function handleClickOutside(event) { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setDropdownOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);
  return (
    <header className="header">
      <div className="profile-container" ref={dropdownRef}>
        <div className="profile-icon" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <User size={20} strokeWidth={2.5} />
        </div>
        {dropdownOpen && (
          <div className="dropdown-menu">
            <div className="dropdown-menu-header"><p>Admin BKN</p><span>Administrator</span></div>
            <a href="#" className="dropdown-item">Profil Saya</a>
            <a href="#" className="dropdown-item">Pengaturan</a>
            <a href="#" onClick={handleLogout} className="dropdown-item logout">Logout</a>
          </div>
        )}
      </div>
    </header>
  );
}

// === KOMPONEN SIDEBAR (Sama seperti V7) ===
function Sidebar() {
  const location = useLocation();
  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/lentera", label: "Lentera", icon: Target },
    { href: "/selayar", label: "Selayar", icon: Activity },
    { href: "/nakhoda", label: "Nakhoda", icon: Network },
  ];
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <img src="/logo_BKN.png" alt="Logo BKN" className="logo-bkn" /> 
        <img src="/Navigara.png" alt="Logo NAVIGARA" className="logo-navigara" />
      </div>
      <ul className="sidebar-nav">
        {navItems.map((item) => {
           const Icon = item.icon;
           return ( <li key={item.href}><Link to={item.href} className={location.pathname === item.href ? 'active' : ''}><Icon size={20} strokeWidth={2.5} /> {item.label}</Link></li> );
        })}
      </ul>
      <div className="sidebar-footer">
        <img src="/JB_Ori.png" alt="Logo JangkarBesi" className="logo-jangkarbesi" />
      </div>
    </nav>
  );
}

export default App;