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

const RankingCard = ({ item, rank }) => {
  const total = Number(item.sub_praca) + Number(item.dedicado);
  return (
    <motion.div 
      className="glass ranking-card fade-in"
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
    >
      <div className={`rank-number ${rank <= 3 ? `rank-${rank}` : ''}`}>
        {rank}
      </div>
      <div className="player-info">
        <div className="player-name">{item.nome}</div>
        <div className="player-meta">
          {item.sub_praca > 0 && `Sub Praça: ${item.sub_praca}`}
          {item.sub_praca > 0 && item.dedicado > 0 && ' | '}
          {item.dedicado > 0 && `Dedicado: ${item.dedicado}`}
        </div>
      </div>
      <div className="score-box">
        <div className="score-total">{total}</div>
        <div className="player-meta">pontos</div>
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
      .eq('sub', type)
      .order('id', { ascending: false }); // We'll sort by sum in JS for now as it's easier without a DB View

    if (error) {
      console.error('Error fetching:', error);
    } else {
      // Rule 3: Total = SUB PRAÇA + DEDICADO
      const sorted = participants
        .map(p => ({ ...p, total: Number(p.sub_praca) + Number(p.dedicado) }))
        .sort((a, b) => b.total - a.total);
      setData(sorted);
    }
    setLoading(false);
  }

  const filteredData = data.filter(item => 
    item.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container">
      <Header 
        title={type === 'DEDICADO' ? 'Ranking Dedicado' : 'Ranking Sub Praça'} 
        subtitle="Sorocaba em Ação" 
      />
      
      <div className="glass" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Search size={20} color="var(--text-muted)" />
        <input 
          type="text" 
          placeholder="Buscar nome..." 
          style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', flex: 1, fontSize: '1rem' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="ranking-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Carregando...</div>
        ) : filteredData.length > 0 ? (
          <AnimatePresence>
            {filteredData.map((item, index) => (
              <RankingCard key={item.id} item={item} rank={index + 1} />
            ))}
          </AnimatePresence>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Nenhum resultado encontrado.</div>
        )}
      </div>
    </div>
  );
};

const AdminPage = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFile = (e) => {
    const f = e.target.files[0];
    setFile(f);
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

        console.log('Rows parsed:', rows);

        // Map columns: UUID | NOME | SUB PRAÇA | DEDICADO | SUB
        // Note: Field names in Excel might vary, let's normalize them
        const normalized = rows.map(r => ({
          uuid_excel: r['UUID'] || r['id'] || '',
          nome: r['NOME'] || r['nome'] || 'Sem Nome',
          sub_praca: Number(r['SUB PRAÇA'] || r['sub_praca'] || 0),
          dedicado: Number(r['DEDICADO'] || r['dedicado'] || 0),
          sub: (r['SUB'] || r['sub'] || '').toUpperCase().trim(),
        }));

        setStatus('Limpando banco de dados...');
        // Clear current data
        await supabase.from('participantes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        setStatus(`Enviando ${normalized.length} registros...`);
        const { error } = await supabase.from('participantes').insert(normalized);

        if (error) throw error;
        
        setStatus('Sucesso! Ranking atualizado.');
        setFile(null);
      } catch (err) {
        console.error(err);
        setStatus('Erro ao processar: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="container">
      <Header title="Administração" subtitle="Atualize os dados do Ranking" />
      
      <div className="glass" style={{ padding: '2rem' }}>
        <div className="uploader-area">
          <Upload size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <p style={{ marginBottom: '1.5rem' }}>Arraste ou selecione o arquivo Excel (.xlsx)</p>
          <input type="file" accept=".xlsx, .xls" onChange={handleFile} style={{ marginBottom: '1rem', display: 'block', margin: '0 auto' }} />
          
          {file && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Arquivo: {file.name}</p>
              <button 
                className="btn-primary" 
                onClick={uploadExcel}
                disabled={uploading}
              >
                {uploading ? 'Processando...' : 'Atualizar Ranking agora'}
              </button>
            </div>
          )}
        </div>
        
        {status && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: status.includes('Erro') ? 'var(--accent)' : 'var(--text-muted)' }}>
            {status}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Atenção: O upload substituirá todos os dados atuais.
        </p>
      </div>
    </div>
  );
};

// --- App Main ---

export default function App() {
  const location = useLocation();

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<RankingPage type="DEDICADO" />} />
        <Route path="/dedicado" element={<RankingPage type="DEDICADO" />} />
        <Route path="/sub-praça" element={<RankingPage type="SUB PRAÇA" />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>

      <nav className="glass bottom-nav">
        <NavLink to="/dedicado" className={({ isActive }) => `nav-item ${isActive || location.pathname === '/' ? 'active' : ''}`}>
          <Trophy size={20} />
          <span>Dedicado</span>
        </NavLink>
        <NavLink to="/sub-praça" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Users size={20} />
          <span>Sub Praça</span>
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Upload size={20} />
          <span>Admin</span>
        </NavLink>
      </nav>
    </div>
  );
}
