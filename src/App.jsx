import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Upload, Search, LogOut, ChevronRight, Hash } from 'lucide-react';

// Supabase Init
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Components ---

const Header = ({ title, subtitle }) => (
  <header className="fade-in">
    <h1>{title}</h1>
    <h2>{subtitle}</h2>
  </header>
);

const RankingItem = ({ item, index }) => {
  const rank = item.originalRank;
  const total = item.total;
  
  return (
    <motion.div 
      className="glass ranking-card"
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
    >
      <div className={`rank-number ${rank <= 3 ? `rank-${rank}` : ''}`}>
        {rank <= 3 ? <Trophy size={20} /> : rank}
      </div>

      <div className="player-info">
        <div className="player-name">{item.nome}</div>
        <div className="player-meta">
          {item.sub_praca > 0 && <span>Sub: <b>{item.sub_praca}</b></span>}
          {item.sub_praca > 0 && item.dedicado > 0 && <span style={{margin: '0 4px', opacity: 0.3}}>|</span>}
          {item.dedicado > 0 && <span>Ded: <b>{item.dedicado}</b></span>}
        </div>
      </div>
      <div className="score-container">
        <span className="score-total">{total}</span>
        <span className="score-label">Corridas Completadas</span>
      </div>

    </motion.div>

  );
};


const RankingPage = ({ type }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [type]);

  async function fetchData() {
    setLoading(true);
    const { data: participants, error } = await supabase
      .from('participantes')
      .select('*')
      .eq('sub', type);

    if (error) {
      console.error('Error fetching:', error);
    } else {
      const processed = participants
        .map(p => ({ ...p, total: Number(p.sub_praca) + Number(p.dedicado) }))
        .sort((a, b) => b.total - a.total)
        .map((p, index) => ({ ...p, originalRank: index + 1 }));
      
      setData(processed);
    }
    setLoading(false);
  }


  const filteredData = React.useMemo(() => {
    return data.filter(item => 
      item.nome.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);


  return (
    <motion.div 
      className="container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Header 
        title={type === 'DEDICADO' ? 'Dedicado' : 'Sub Praça'} 
        subtitle="Ranking Sorocaba" 
      />
      
      <div className="glass search-container">
        <Search size={18} color="var(--primary)" />
        <input 
          type="text" 
          placeholder="Filtrar por nome..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="clear-btn" onClick={() => setSearch('')}>×</button>
        )}
      </div>

      <div className="ranking-list">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Carregando ranking...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredData.map((item, index) => (
              <RankingItem key={item.id} item={item} index={index} />
            ))}
          </AnimatePresence>
        ) : (
          <motion.div 
            className="empty-state glass"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Search size={40} opacity={0.2} />
            <p>Nenhum participante encontrado.</p>
          </motion.div>
        )}
      </div>
    </motion.div>

  );
};

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const uploadExcel = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('Lendo arquivo...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const normalized = rows.map(r => ({
          uuid_excel: String(r['UUID'] || r['id'] || ''),
          nome: String(r['NOME'] || r['nome'] || 'Sem Nome'),
          sub_praca: Number(r['SUB PRAÇA'] || r['sub_praca'] || 0),
          dedicado: Number(r['DEDICADO'] || r['dedicado'] || 0),
          sub: String(r['SUB'] || r['sub'] || '').toUpperCase().trim(),
        })).filter(r => r.nome !== 'Sem Nome');

        setStatus('Limpando ranking anterior...');
        await supabase.from('participantes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        setStatus(`Enviando ${normalized.length} registros...`);
        const { error } = await supabase.from('participantes').insert(normalized);

        if (error) throw error;
        
        setStatus('✓ Ranking atualizado com sucesso!');
        setFile(null);
      } catch (err) {
        console.error(err);
        setStatus('❌ Erro: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <motion.div 
      className="container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Header title="Upload" subtitle="Atualizar Banco de Dados" />
      
      <div className="glass uploader-container">
        <div className="uploader-area">
          <div className="icon-wrapper">
            <Upload size={32} color="#fff" />
          </div>
          <h3>Planilha do Ranking</h3>
          <p>Selecione o arquivo .xlsx para atualizar as posições.</p>
          
          <label className="file-input-label">
            {file ? file.name : 'Selecionar Arquivo'}
            <input type="file" accept=".xlsx, .xls" onChange={handleFile} hidden />
          </label>
          
          {file && (
            <button 
              className="btn-primary push-top" 
              onClick={uploadExcel}
              disabled={uploading}
              style={{ width: '100%', marginTop: '1.5rem' }}
            >
              {uploading ? 'Processando...' : 'Confirmar Upload'}
            </button>
          )}
        </div>
        
        <AnimatePresence mode="wait">
          {status && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="status-message"
            >
              {status}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// --- App Main ---

export default function App() {
  const location = useLocation();

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<RankingPage type="DEDICADO" />} />
          <Route path="/dedicado" element={<RankingPage type="DEDICADO" />} />
          <Route path="/sub-praça" element={<RankingPage type="SUB PRAÇA" />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </AnimatePresence>

      <nav className="glass bottom-nav">
        <NavLink to="/dedicado" className={({ isActive }) => `nav-item ${isActive || location.pathname === '/' ? 'active' : ''}`}>
          <div className="nav-icon"><Trophy size={18} /></div>
          <span>Dedicado</span>
        </NavLink>
        <NavLink to="/sub-praça" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon"><Users size={18} /></div>
          <span>Sub Praça</span>
        </NavLink>
      </nav>

    </div>
  );
}

