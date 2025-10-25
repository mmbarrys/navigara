import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Import Link
import axios from 'axios';
import { API_URL } from '../App';

function Login({ setAuth }) {
  const [username, setUsername] = useState('admin'); // Default username
  const [password, setPassword] = useState(''); // Kosongkan password default
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Tambah state loading
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); // Mulai loading
    setError(''); // Reset error

    // --- Versi 1: Login Default (Untuk Hackathon/Demo) ---
    if (username === 'admin' && password === 'admin123') {
        // Simulasi login sukses
        const dummyToken = 'dummy-token-12345';
        localStorage.setItem('token', dummyToken);
        setAuth(dummyToken);
        navigate('/'); // Arahkan ke dashboard
        setLoading(false); // Stop loading
        return; // Hentikan eksekusi
    }
    // --- Akhir Versi 1 ---

    /* // --- Versi 2: Integrasi Database (Template Masa Depan) ---
    // Uncomment bagian ini ketika backend database sudah siap
    
    try {
      // Panggil API login backend Anda yang sesungguhnya
      const response = await axios.post(`${API_URL}/api/auth/login`, { username, password }); 
      
      if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        // localStorage.setItem('user', JSON.stringify(response.data.user)); // Simpan data user jika ada
        setAuth(response.data.token);
        navigate('/'); // Arahkan ke dashboard
      } else {
         setError(response.data.message || 'Login gagal.'); 
      }
    } catch (err) {
       console.error("Login API Error:", err);
       setError(err.response?.data?.message || 'Terjadi kesalahan saat login.');
    } finally {
        setLoading(false); // Stop loading di akhir
    }
    // --- Akhir Versi 2 ---
    */

    // Jika sampai sini (menggunakan Versi 1), berarti login default gagal
    if (username !== 'admin' || password !== 'admin123') {
        setError('Username atau password salah.');
    }
    setLoading(false); // Stop loading jika login default gagal
  };

  return (
    <div className="login-page-container animate-fade-in"> {/* Container baru */}
      <div className="login-wrapper glass"> {/* Wrapper dengan efek glass */}
        
        {/* Tombol Kembali */}
        <Link to="/" className="back-to-home-button">
           {/* Ganti dengan ikon jika mau */}
           &larr; Kembali ke Beranda 
        </Link>

        <div className="login-logo-section">
            <img 
              src="/Navigara.png" // Ganti ke logo utama
              alt="Logo NAVIGARA" 
              className="login-logo" // Gunakan class
            />
        </div>

        <div className="login-form-section">
          <h2>Masuk ke NAVIGARA</h2>
          <form onSubmit={handleLogin}>
            <div>
              <label htmlFor="username">Username</label>
              <input 
                id="username"
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required // Tambahkan validasi dasar
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input 
                id="password"
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                disabled={loading}
              />
            </div>
            
            {/* Tampilkan Error */}
            {error && <p className="login-error">{error}</p>}
            
            <button type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Login'}
            </button>
          </form>

          {/* Placeholder untuk Sign Up */}
          <p className="signup-link">
            Belum punya akun? <Link to="/#">Daftar di sini</Link> 
            {/* Arahkan ke halaman registrasi jika sudah dibuat */}
            <br/>
            <small>(Fitur pendaftaran akan datang)</small>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;