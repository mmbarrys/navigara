import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { API_URL, useAppContext } from '../App';
import AiOutput from '../components/AiOutput';

// --- Default Data (Hanya untuk Editor JSON) ---
const DUMMY_PEGAWAI_JSON = `[
  {"id": "1", "nama": "Anya (Kinerja Tinggi)", "jabatan": "Analis Kebijakan", "unit": "Direktorat A", "skor_potensi": 90, "skor_kinerja": 95},
  {"id": "2", "nama": "Budi (Potensi Tinggi)", "jabatan": "Pranata Komputer", "unit": "Direktorat A", "skor_potensi": 95, "skor_kinerja": 70},
  {"id": "3", "nama": "Citra (Sentral)", "jabatan": "Analis SDM", "unit": "Biro SDM", "skor_potensi": 80, "skor_kinerja": 85}
]`;
const DUMMY_KOLABORASI_JSON = `[
  {"source": "1", "target": "2", "project": "Proyek A1"},
  {"source": "1", "target": "3", "project": "Lintas Unit"},
  {"source": "2", "target": "3", "project": "Lintas Unit"}
]`;
// ---------------------------------------------

// --- Fungsi Layout ---
const getLayoutedElements = (nodes, edges) => {
  nodes.forEach((node, index) => {
    node.position = { x: (index % 5) * 250, y: Math.floor(index / 5) * 150 };
  });
  return { nodes, edges };
};

function Nakhoda() {
  const { candidateScores } = useAppContext(); // Skor dari Lentera/Selayar

  // State Graf & Hasil
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [metrics, setMetrics] = useState(null);
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State Data Mentah (digunakan untuk simulasi)
  const [pegawaiList, setPegawaiList] = useState([]);
  const [kolaborasiList, setKolaborasiList] = useState([]); // Tetap ada, tapi default kosong di setup manual

  // State Editor JSON
  const [pegawaiJsonText, setPegawaiJsonText] = useState(DUMMY_PEGAWAI_JSON);
  const [kolaborasiJsonText, setKolaborasiJsonText] = useState(DUMMY_KOLABORASI_JSON);

  // State Setup Manual
  const [manualTeam, setManualTeam] = useState([{ id: 'emp-0', nama: '', jabatan: '', unit: '', skor_potensi: 50, skor_kinerja: 50 }]);

  // State Simulasi
  const [allPegawaiSimulasi, setAllPegawaiSimulasi] = useState([]);
  const [allUnitsSimulasi, setAllUnitsSimulasi] = useState([]);
  const [selectedPegawaiId, setSelectedPegawaiId] = useState('');
  const [targetUnit, setTargetUnit] = useState('');

  const [activeTab, setActiveTab] = useState('manual'); // Default ke tab manual

  // --- Fungsi Utama ---

  // 1. Memproses data dari backend (JSON atau default) ke state ReactFlow & state mentah
  const processGraphData = (data, sourcePegawaiList = [], sourceKolaborasiList = []) => {
    setError('');
    if (!data || !data.nodes || !data.edges) {
      setError("Data graf tidak valid."); setLoading(false); return;
    }
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(data.nodes, data.edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setMetrics(data.metrics);
    setPegawaiList(sourcePegawaiList); // Simpan data mentah
    setKolaborasiList(sourceKolaborasiList);

    // Perbarui dropdown simulasi
    const pegawaiDropdown = sourcePegawaiList.map(p => ({ id: p.id, label: p.nama }));
    const unitDropdown = [...new Set(sourcePegawaiList.map(p => p.unit))];
    
    // Cek dan tambahkan kandidat ke dropdown jika belum ada
    if (candidateScores.skor_potensi !== null || candidateScores.skor_kinerja !== null) {
      const existing = pegawaiDropdown.find(p => p.id === candidateScores.id);
      if (!existing) {
        pegawaiDropdown.push({ id: candidateScores.id, label: `${candidateScores.nama} (Kandidat)` });
      }
    }

    setAllPegawaiSimulasi(pegawaiDropdown);
    setAllUnitsSimulasi(unitDropdown);
    if (pegawaiDropdown.length > 0) setSelectedPegawaiId(pegawaiDropdown[0].id);
    if (unitDropdown.length > 0) setTargetUnit(unitDropdown[0]);
    setLoading(false);
  };

  // 2. Mengambil data default dari backend (dummy_data_v2.json)
  const fetchDefaultGraph = useCallback(async () => {
    setLoading(true); setError(''); setReport('');
    try {
      const response = await axios.get(`${API_URL}/api/nakhoda/get-graph`);
      // Ambil data mentah dari file dummy juga (untuk konsistensi)
       let defaultPegawai, defaultKolaborasi;
       try {
           defaultPegawai = JSON.parse(DUMMY_PEGAWAI_JSON);
           defaultKolaborasi = JSON.parse(DUMMY_KOLABORASI_JSON);
       } catch {
           defaultPegawai = []; defaultKolaborasi = [];
       }
      processGraphData(response.data, defaultPegawai, defaultKolaborasi);
      // Reset editor ke default
      setPegawaiJsonText(DUMMY_PEGAWAI_JSON);
      setKolaborasiJsonText(DUMMY_KOLABORASI_JSON);
    } catch (err) { setError(`Gagal mengambil data default: ${err.message}`); setLoading(false); }
  }, [setNodes, setEdges]); // dependensi ReactFlow

  // Efek untuk memuat data default sekali saja
  useEffect(() => {
    fetchDefaultGraph();
  }, [fetchDefaultGraph]);

  // 3. Memuat data KUSTOM dari Editor JSON
  const handleLoadCustomData = async () => {
    setLoading(true); setError(''); setReport('');
    try {
      const parsedPegawai = JSON.parse(pegawaiJsonText);
      const parsedKolaborasi = JSON.parse(kolaborasiJsonText);
      const response = await axios.post(`${API_URL}/api/nakhoda/load-custom-graph`, {
        pegawaiData: pegawaiJsonText,
        kolaborasiData: kolaborasiJsonText,
      });
      processGraphData(response.data, parsedPegawai, parsedKolaborasi);
      setActiveTab('visualisasi'); // Pindah ke tab visualisasi
    } catch (err) { setError(`Error memuat data JSON: ${err.response?.data?.error || err.message}`); setLoading(false); }
  };

  // 4. Memproses data dari SETUP MANUAL
  const handleProcessManualData = () => {
    setLoading(true); setError(''); setReport('');
    
    // Gabungkan data manual dengan kandidat (jika ada skornya)
    let combinedPegawaiList = [...manualTeam];
    const candidateExistsInManual = manualTeam.some(p => p.id === candidateScores.id);

    if (!candidateExistsInManual && (candidateScores.skor_potensi !== null || candidateScores.skor_kinerja !== null)) {
      combinedPegawaiList.push({
        id: candidateScores.id,
        nama: candidateScores.nama,
        unit: 'Belum Ditempatkan', // Unit default untuk kandidat
        jabatan: 'Kandidat',
        skor_potensi: candidateScores.skor_potensi ?? 50,
        skor_kinerja: candidateScores.skor_kinerja ?? 50,
      });
    }
    
    // Panggil backend analyze_graph (TANPA kolaborasi)
    // Kita simulasi panggilannya di frontend agar cepat
    const tempGraphData = analyzeGraphLocally(combinedPegawaiList, []); // Kirim array kolaborasi kosong
    
    processGraphData(tempGraphData, combinedPegawaiList, []);
    setActiveTab('visualisasi'); // Pindah ke tab visualisasi
  };
  
  // Fungsi Analisis Graf Lokal (mirip backend, tapi di JS) - untuk setup manual
  const analyzeGraphLocally = (pegawai, kolaborasi) => {
      let totalEffectiveness = 0;
      const nodes = pegawai.map(p => {
          const potensi = p.skor_potensi ?? 50;
          const kinerja = p.skor_kinerja ?? 50;
          const combinedScore = (kinerja * 0.6) + (potensi * 0.4);
          // Di setup manual, kita anggap centrality = 0
          totalEffectiveness += (combinedScore * (1 + 0)); 
          
          let background = '#90EE90'; // Hijau
          if (combinedScore < 80) background = '#FFD700'; // Kuning
          if (combinedScore < 60) background = '#F08080'; // Merah

          return {
              id: p.id, position: { x: 0, y: 0 },
              data: { label: `${p.nama} (${p.unit})\nSkor: ${combinedScore.toFixed(0)}` },
              style: { background, border: "1px solid #333", whiteSpace: "pre-line", textAlign: "center" }
          };
      });
      
      // Di setup manual, edge kosong
      const edges = []; 
      
      const metrics = {
          total_pegawai: pegawai.length,
          total_kolaborasi: 0,
          avg_effectiveness: pegawai.length > 0 ? totalEffectiveness / pegawai.length : 0,
          num_silos: pegawai.length > 0 ? 1 : 0 // Asumsi 1 silo jika tanpa kolaborasi
      };
      return { nodes, edges, metrics };
  }

  // 5. Menjalankan SIMULASI
  const handleRunSimulation = async () => {
    setLoading(true); setReport(''); setError('');
    
    // Siapkan data pegawai saat ini, PERBARUI skor kandidat jika dia yg disimulasi
    let currentPegawaiList = pegawaiList.map(p => {
        if (p.id === candidateScores.id) {
            return { // Update skor dari context
                ...p,
                skor_potensi: candidateScores.skor_potensi ?? p.skor_potensi ?? 50,
                skor_kinerja: candidateScores.skor_kinerja ?? p.skor_kinerja ?? 50,
            };
        }
        return p;
    });
    
     // Tambah kandidat jika dia dipilih tapi belum ada di list
     const candidateInList = currentPegawaiList.some(p => p.id === candidateScores.id);
     if (selectedPegawaiId === candidateScores.id && !candidateInList && (candidateScores.skor_potensi !== null || candidateScores.skor_kinerja !== null)) {
         currentPegawaiList.push({
             id: candidateScores.id, nama: candidateScores.nama, unit: 'Temporary', jabatan: 'Kandidat',
             skor_potensi: candidateScores.skor_potensi ?? 50, skor_kinerja: candidateScores.skor_kinerja ?? 50,
         });
     }

    try {
      const response = await axios.post(`${API_URL}/api/nakhoda/simulate-move`, {
        pegawaiId: selectedPegawaiId,
        targetUnit: targetUnit,
        pegawaiList: currentPegawaiList, // Kirim list pegawai TERBARU
        kolaborasiList: kolaborasiList // Kirim list kolaborasi (bisa kosong)
      });
      
      // Proses hasil simulasi (data graf baru)
      const simPegawaiList = response.data.nodes.map(n => {
          // Rekonstruksi data mentah dari node (agak merepotkan, idealnya backend kirim list mentah juga)
          const skorMatch = n.data.label.match(/Skor: (\d+)/);
          const skor = skorMatch ? parseInt(skorMatch[1]) : 50;
           return {
              id: n.id,
              nama: n.data.label.split('\n')[0],
              unit: n.data.label.match(/\((.*?)\)/)[1],
              // Kita tidak tahu skor potensi/kinerja individu setelah simulasi,
              // jadi kita gunakan skor gabungan saja untuk update state mentah
              skor_potensi: skor, 
              skor_kinerja: skor 
           };
      });
      processGraphData(response.data, simPegawaiList, kolaborasiList); // Update graf & dropdown
      setReport(response.data.report); 
    } catch (err) { setError(`Error simulasi: ${err.response?.data?.error || err.message}`); }
    setLoading(false);
  };

  // --- Fungsi Helper Setup Manual ---
  const handleManualTeamChange = (index, field, value) => {
    const updatedTeam = [...manualTeam];
    updatedTeam[index][field] = value;
    // Otomatis beri ID unik
    if (!updatedTeam[index].id || updatedTeam[index].id.startsWith('emp-')) {
        updatedTeam[index].id = `manual-${index}-${Date.now()}`;
    }
    setManualTeam(updatedTeam);
  };

  const addManualTeamMember = () => {
    setManualTeam([...manualTeam, { id: `emp-${manualTeam.length}`, nama: '', jabatan: '', unit: '', skor_potensi: 50, skor_kinerja: 50 }]);
  };

  const removeManualTeamMember = (index) => {
    setManualTeam(manualTeam.filter((_, i) => i !== index));
  };
  // --------------------------------

  if (!metrics && loading) {
    return <div className="module-container">Memuat Modul Nakhoda...</div>;
  }

  return (
    <div className="module-container">
      <h2>Modul NAKHODA - Simulasi Meritokrasi Strategis</h2>
      
      {error && <div className="result-box" style={{ background: 'rgba(255, 77, 79, 0.2)', borderColor: 'var(--accent-red)' }}><h4>Error:</h4><p>{error}</p></div>}

      {/* --- TAB KONTROL --- */}
      <div className="tab-container">
        <button className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>1. Setup Manual</button>
        <button className={`tab-button ${activeTab === 'visualisasi' ? 'active' : ''}`} onClick={() => setActiveTab('visualisasi')}>2. Visualisasi & Simulasi</button>
        <button className={`tab-button ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>Editor JSON (Advanced)</button>
      </div>

      {/* --- KONTEN TAB 1: SETUP MANUAL --- */}
      <div className={`tab-content ${activeTab === 'manual' ? 'active' : ''}`}>
        <p>Masukkan data tim/unit yang ingin Anda simulasikan. Skor kandidat dari Lentera/Selayar akan otomatis ditambahkan.</p>
        
        {/* Tampilkan Info Kandidat */}
        {(candidateScores.skor_potensi !== null || candidateScores.skor_kinerja !== null) && (
            <div className="card" style={{ background: 'rgba(0, 191, 255, 0.1)', marginBottom: '15px' }}>
                <strong>Kandidat Terdeteksi:</strong> {candidateScores.nama} (Skor Potensi: {candidateScores.skor_potensi ?? 'N/A'}, Skor Kinerja: {candidateScores.skor_kinerja ?? 'N/A'})
            </div>
        )}

        {/* Form Input Pegawai Manual */}
        {manualTeam.map((member, index) => (
            <div key={index} className="card" style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                 <input type="text" placeholder="Nama Pegawai" value={member.nama} onChange={(e) => handleManualTeamChange(index, 'nama', e.target.value)} style={{flexBasis: '180px'}}/>
                 <input type="text" placeholder="Jabatan" value={member.jabatan} onChange={(e) => handleManualTeamChange(index, 'jabatan', e.target.value)} style={{flexBasis: '150px'}}/>
                 <input type="text" placeholder="Unit/Direktorat" value={member.unit} onChange={(e) => handleManualTeamChange(index, 'unit', e.target.value)} style={{flexBasis: '150px'}}/>
                 <input type="number" placeholder="Skor Potensi (1-100)" value={member.skor_potensi} onChange={(e) => handleManualTeamChange(index, 'skor_potensi', parseInt(e.target.value))} style={{width: '100px'}}/>
                 <input type="number" placeholder="Skor Kinerja (1-100)" value={member.skor_kinerja} onChange={(e) => handleManualTeamChange(index, 'skor_kinerja', parseInt(e.target.value))} style={{width: '100px'}}/>
                 <button onClick={() => removeManualTeamMember(index)} style={{background: 'var(--accent-red)', marginLeft: 'auto'}} disabled={manualTeam.length <= 1}>Hapus</button>
            </div>
        ))}
        <button onClick={addManualTeamMember}>+ Tambah Anggota Tim</button>
        
        <button onClick={handleProcessManualData} disabled={loading} style={{ width: '100%', padding: '15px', fontSize: '1.2rem', marginTop: '20px' }}>
          {loading ? 'Memproses...' : 'Lanjut ke Visualisasi & Simulasi'}
        </button>
      </div>

      {/* --- KONTEN TAB 2: VISUALISASI & SIMULASI --- */}
      <div className={`tab-content ${activeTab === 'visualisasi' ? 'active' : ''}`}>
        <p>Gunakan panel di bawah untuk mensimulasikan perpindahan pegawai dan lihat dampaknya.</p>
        <div className="simulation-controls card" style={{ marginBottom: '20px' }}>
          <h4>Panel Simulasi</h4>
          <label>Pindahkan Pegawai:</label>
          <select value={selectedPegawaiId} onChange={(e) => setSelectedPegawaiId(e.target.value)}>
             {allPegawaiSimulasi.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label style={{ marginLeft: '10px' }}>Ke Unit:</label>
          <select value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)}>
            {allUnitsSimulasi.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={handleRunSimulation} disabled={loading} style={{ marginLeft: '10px' }}>
            {loading ? 'Mensimulasi...' : 'Jalankan Simulasi'}
          </button>
        </div>
        <div className="nakhoda-container">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Controls />
            <MiniMap />
            <Background variant="dots" />
          </ReactFlow>
        </div>
        <div className="nakhoda-results" style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <div className="card" style={{ flex: 1 }}>
            <h3>Metrik Organisasi</h3>
            {metrics ? (
              <ul>
                <li>Total Pegawai: {metrics.total_pegawai}</li>
                <li>Total Kolaborasi: {metrics.total_kolaborasi}</li>
                <li>Jumlah Silo (Pulau): {metrics.num_silos}</li>
                <li style={{color: 'var(--accent-blue)', fontSize: '1.2rem', fontWeight: '600'}}>
                  Skor Efektivitas: {Number(metrics.avg_effectiveness).toFixed(2)}
                </li>
              </ul>
            ) : <p>Memuat metrik...</p>}
          </div>
          <div className="card" style={{ flex: 2, background: 'rgba(0, 191, 255, 0.1)' }}>
            <h3>Laporan Dampak Simulasi</h3>
            <AiOutput text={report || "Jalankan simulasi untuk melihat laporan dampak..."} />
          </div>
        </div>
      </div>

      {/* --- KONTEN TAB 3: EDITOR JSON --- */}
      <div className={`tab-content ${activeTab === 'editor' ? 'active' : ''}`}>
        <p>Edit data JSON (format harus valid) untuk memuat struktur kompleks. Pastikan ada `skor_potensi` & `skor_kinerja`.</p>
        <div className="nakhoda-editor">
          <textarea value={pegawaiJsonText} onChange={(e) => setPegawaiJsonText(e.target.value)} />
          <textarea value={kolaborasiJsonText} onChange={(e) => setKolaborasiJsonText(e.target.value)} />
        </div>
        <button onClick={handleLoadCustomData} disabled={loading} style={{ marginTop: '10px', width: '100%' }}>
          {loading ? 'Memuat...' : 'Terapkan & Muat Graf Kustom'}
        </button>
      </div>
    </div>
  );
}

export default Nakhoda;