import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import { Trash2, AlertTriangle, CheckCircle } from 'lucide-react'; // Ikon

function AssessmentHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/history`);
      setHistory(response.data);
    } catch (err) {
      setError(`Gagal memuat riwayat: ${err.response?.data?.error || err.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus entri riwayat ini?")) {
      return;
    }
    setError('');
    try {
      await axios.delete(`${API_URL}/api/history/${id}`);
      // Refresh history setelah delete
      fetchHistory(); 
    } catch (err) {
       setError(`Gagal menghapus entri: ${err.response?.data?.error || err.message}`);
    }
  };
  
   // Helper untuk warna rekomendasi
   const getRecommendationClass = (rec) => {
       if (!rec) return '';
       const lowerRec = rec.toLowerCase();
       if (lowerRec.includes('sangat') || lowerRec.includes('direkomendasikan')) return 'text-success';
       if (lowerRec.includes('dipertimbangkan')) return 'text-warning';
       if (lowerRec.includes('butuh')) return 'text-error';
       return '';
   }
   // Helper untuk ikon rekomendasi
   const getRecommendationIcon = (rec) => {
       if (!rec) return null;
       const lowerRec = rec.toLowerCase();
       if (lowerRec.includes('sangat') || lowerRec.includes('direkomendasikan')) return <CheckCircle size={16} className="text-success inline-block mr-1"/>;
       if (lowerRec.includes('dipertimbangkan') || lowerRec.includes('butuh')) return <AlertTriangle size={16} className="text-warning inline-block mr-1"/>;
       return null;
   }

  return (
    <div className="module-container">
      <h2>Riwayat Asesmen & Audit</h2>
      <p>Menampilkan log aktivitas dari Modul Lentera dan Selayar.</p>

      {loading && <p>Memuat riwayat...</p>}
      {error && <div className="result-box error-box"><h4>Error:</h4><p>{error}</p></div>}

      {!loading && history.length === 0 && (
        <div className="card text-center p-8 mt-6">
          <p className="text-muted-foreground">Belum ada riwayat asesmen yang tersimpan.</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div className="history-table-container card" style={{ marginTop: '20px', padding: '0' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Modul</th>
                <th>Nama/Program</th>
                <th>Jabatan/Detail</th>
                <th>Skor Potensi</th>
                <th>Skor Kinerja</th>
                <th>Rekom/Sentimen</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {history.map((log) => (
                <tr key={log.id} className="animate-fade-in">
                  <td>{log.timestamp}</td>
                  <td>{log.module}</td>
                  <td>{log.candidate_name || '-'}</td>
                  <td>{log.jabatan_or_program || '-'}</td>
                  <td>{log.skor_potensi ?? '-'}</td>
                  <td>{log.skor_kinerja ?? '-'}</td>
                  <td className={getRecommendationClass(log.recommendation || log.sentiment)}>
                    {getRecommendationIcon(log.recommendation || log.sentiment)}
                    {log.recommendation || log.sentiment || '-'}
                  </td>
                  <td>
                    <button 
                      onClick={() => handleDelete(log.id)} 
                      className="delete-button"
                      title="Hapus Entri"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AssessmentHistory;