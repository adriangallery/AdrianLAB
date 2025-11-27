import Head from 'next/head';
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [traits, setTraits] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const traitsPerPage = 6;

  // Estados para el caché de floppy metadata y render
  const [floppyCacheStats, setFloppyCacheStats] = useState(null);
  const [floppyCacheLoading, setFloppyCacheLoading] = useState(false);
  const [adrianZeroCacheStats, setAdrianZeroCacheStats] = useState(null);
  const [contractCacheStats, setContractCacheStats] = useState(null);
  const [jsonCacheStats, setJsonCacheStats] = useState(null);
  const [svgPngCacheStats, setSvgPngCacheStats] = useState(null);
  const [componentCacheStats, setComponentCacheStats] = useState(null);
  const [floppyRefreshForm, setFloppyRefreshForm] = useState({
    tokenId: '',
    startId: '',
    endId: '',
    type: 'both' // 'metadata', 'render', 'both'
  });

  // Estados para el generador de grids
  const [gridForm, setGridForm] = useState({
    startToken: '1',
    endToken: '300',
    tokensPerRow: '10'
  });
  const [gridLoading, setGridLoading] = useState(false);
  const [gridResult, setGridResult] = useState(null);
  const [gridStats, setGridStats] = useState(null);

  // Estados para el panel de endpoints de render
  const [selectedTags, setSelectedTags] = useState([]);
  const [endpointSearch, setEndpointSearch] = useState('');

  useEffect(() => {
    loadTraits();
    fetchFloppyCacheStats();
  }, []);

  const loadTraits = async () => {
    setLoading(true);
    try {
      // Cargar traits del 1 al 557 (traits normales)
      const traitsData = [];
      
      // Traits normales (1-557)
      for (let i = 1; i <= 557; i++) {
        traitsData.push({
          id: i,
          name: `Trait #${i}`,
          imageUrl: `/api/render/floppy/${i}.png?v=${Date.now()}`,
          type: 'trait'
        });
      }
      
      // Floppy discs (10000-10002)
      for (let i = 10000; i <= 10002; i++) {
        traitsData.push({
          id: i,
          name: `Floppy #${i}`,
          imageUrl: `/labimages/${i}.gif?v=${Date.now()}`,
          type: 'floppy'
        });
      }
      
      // Pagers (15000-15013)
      for (let i = 15000; i <= 15013; i++) {
        traitsData.push({
          id: i,
          name: `Pager #${i}`,
          imageUrl: `/labimages/${i}.gif?v=${Date.now()}`,
          type: 'pager'
        });
      }
      
      setTraits(traitsData);
    } catch (error) {
      console.error('Error loading traits:', error);
    }
    setLoading(false);
  };

  // Función para generar grids de AdrianZERO
  const generateGrid = async () => {
    try {
      setGridLoading(true);
      setGridResult(null);
      setGridStats(null);

      const { startToken, endToken, tokensPerRow } = gridForm;
      
      // Validaciones
      if (!startToken || !endToken || !tokensPerRow) {
        alert('Por favor, completa todos los campos');
        return;
      }

      const start = parseInt(startToken);
      const end = parseInt(endToken);
      const cols = parseInt(tokensPerRow);

      if (start < 1 || end < start || cols < 1) {
        alert('Parámetros inválidos. Verifica que startToken >= 1, endToken >= startToken, tokensPerRow >= 1');
        return;
      }

      if (end - start + 1 > 10000) {
        alert('Rango demasiado grande. Máximo 10,000 tokens por grid');
        return;
      }

      // Calcular estadísticas
      const totalTokens = end - start + 1;
      const rows = Math.ceil(totalTokens / cols);
      const gridWidth = cols * 64;
      const gridHeight = rows * 64;

      setGridStats({ start, end, cols, rows, totalTokens, gridWidth, gridHeight });

      // Generar grid
      const response = await fetch('/api/admin/grid-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startToken: start,
          endToken: end,
          columns: cols
        })
      });

      if (response.ok) {
        // Obtener información del grid
        const gridInfo = response.headers.get('X-Grid-Info');
        
        // Crear blob de la imagen
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);

        setGridResult({ imageUrl, gridInfo });
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error generando grid:', error);
      alert(`Error de conexión: ${error.message}`);
    } finally {
      setGridLoading(false);
    }
  };

  // Función para obtener estadísticas del caché de floppy
  const fetchFloppyCacheStats = async () => {
    try {
      setFloppyCacheLoading(true);
      const response = await fetch('/api/admin/floppy-cache');
      const data = await response.json();
      
      // Verificar que la respuesta tenga la estructura esperada
      if (data && data.action === 'GET_CACHE_STATS' && data.stats) {
        setFloppyCacheStats(data.stats);
        // Los otros cachés no están implementados en este endpoint
        setAdrianZeroCacheStats(null);
        setContractCacheStats(null);
        setJsonCacheStats(null);
        setSvgPngCacheStats(null);
        setComponentCacheStats(null);
      } else {
        console.warn('Respuesta inesperada de la API:', data);
        setFloppyCacheStats(null);
      }
    } catch (error) {
      console.error('Error fetching floppy cache stats:', error);
      setFloppyCacheStats(null);
    } finally {
      setFloppyCacheLoading(false);
    }
  };

  // Función para invalidar caché de floppy
  const invalidateFloppyCache = async (action, params = {}) => {
    try {
      setFloppyCacheLoading(true);
      
      // Mapear acciones del panel principal a la nueva API
      let apiAction = 'clear';
      let apiParams = {};
      
      if (action === 'invalidate_token') {
        apiParams = { tokenId: params.tokenId, action: 'clear' };
      } else if (action === 'clear_all') {
        // Para limpiar todo, usar DELETE
        const response = await fetch('/api/admin/floppy-cache?confirm=true', {
          method: 'DELETE'
        });
        const data = await response.json();
        
        if (response.ok) {
          alert(`✅ ${data.message}\n📊 Entradas limpiadas: ${data.previousStats.total}`);
          fetchFloppyCacheStats(); // Actualizar estadísticas
        } else {
          alert('❌ Error: ' + data.error);
        }
        return;
      } else {
        alert('❌ Acción no soportada en la nueva API');
        return;
      }
      
      const response = await fetch('/api/admin/floppy-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiParams)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ ${data.message}\n📊 Token ID: ${data.tokenId}`);
        fetchFloppyCacheStats(); // Actualizar estadísticas
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error invalidating floppy cache:', error);
      alert('❌ Error invalidando caché');
    } finally {
      setFloppyCacheLoading(false);
    }
  };

  const nextPage = () => {
    if ((currentPage + 1) * traitsPerPage < traits.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const currentTraits = traits.slice(
    currentPage * traitsPerPage,
    (currentPage + 1) * traitsPerPage
  );

  const totalPages = Math.ceil(traits.length / traitsPerPage);

  return (
    <div className={styles.container}>
      <Head>
        <title>🧪 AdrianLAB Renderer</title>
        <meta name="description" content="AdrianLAB NFT Renderer and Metadata" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className={styles.highlight}>🧪 AdrianLAB</span>
        </h1>

        <p className={styles.description}>
          Rendering and metadata server for AdrianLAB NFT collection
        </p>

        <div className={styles.grid}>
          <a href="/api/render/1" className={styles.card}>
            <h2>AdrianZERO &rarr;</h2>
            <p>API for token rendering. Example: /api/render/1</p>
          </a>

          <a href="/api/render/lambo/1?lambo=Lambo_Variant_Red" className={styles.card}>
            <h2>Lambo Render &rarr;</h2>
            <p>Render de AdrianZERO sobre Lambo. Puedes elegir el color del Lambo con el parámetro <code>?lambo=</code>. Ejemplo: /api/render/lambo/1?lambo=Lambo_Variant_Red</p>
          </a>

          <a href="/api/metadata/1" className={styles.card}>
            <h2>MetadataZERO &rarr;</h2>
            <p>API for token metadata. Example: /api/metadata/1</p>
          </a>
          
          <a href="https://adrianlab.vercel.app/api/render/floppy/18.png?v=1751144253455" className={styles.card}>
            <h2>Traits &rarr;</h2>
            <p>Trait images API. Example: /api/render/floppy/18.png</p>
          </a>
          
          <a href="https://adrianlab.vercel.app/api/metadata/floppy/18.json" className={styles.card}>
            <h2>Metadata Traits &rarr;</h2>
            <p>Trait metadata API. Example: /api/metadata/floppy/18.json</p>
          </a>
          
          <a href="https://adrianlab.vercel.app/api/metadata/floppy/10000" className={styles.card}>
            <h2>Floppy &rarr;</h2>
            <p>Pack metadata API. Example: /api/metadata/floppy/10000</p>
          </a>
          
          <a href="https://adrianlab.vercel.app/labimages/10000.gif?v=1751282595734" className={styles.card}>
            <h2>Floppy Images &rarr;</h2>
            <p>Pack images API. Example: /labimages/10000.gif</p>
          </a>
          
          <a href="https://adrianlab.vercel.app/api/render/custom/1?eyes=7&mouth=22" className={styles.card}>
            <h2>Custom Render Tool &rarr;</h2>
            <p>Preview tokens with modified traits. Example: /api/render/custom/1?eyes=7&mouth=22</p>
          </a>
        </div>

        {/* Nueva sección de administración */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🔧 Admin Panel - Traits Viewer</h2>
          
          {loading ? (
            <p>Loading traits...</p>
          ) : (
            <>
              <div className={styles.traitsGrid}>
                {currentTraits.map((trait) => (
                  <div key={trait.id} className={styles.traitCard}>
                    <img 
                      src={trait.imageUrl} 
                      alt={trait.name}
                      className={styles.traitImage}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div className={styles.traitFallback} style={{display: 'none'}}>
                      <p>Image not available</p>
                    </div>
                    <h3>{trait.name}</h3>
                    <p>ID: {trait.id}</p>
                    <p className={styles.traitType}>{trait.type.toUpperCase()}</p>
                  </div>
                ))}
              </div>

              <div className={styles.pagination}>
                <button 
                  onClick={prevPage} 
                  disabled={currentPage === 0}
                  className={styles.paginationButton}
                >
                  ← Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage + 1} of {totalPages} 
                  ({currentPage * traitsPerPage + 1}-{Math.min((currentPage + 1) * traitsPerPage, traits.length)} of {traits.length})
                </span>
                <button 
                  onClick={nextPage} 
                  disabled={(currentPage + 1) * traitsPerPage >= traits.length}
                  className={styles.paginationButton}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>

        {/* Nueva sección de administración de caché para floppy render */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🗄️ Floppy Render Cache Management</h2>
          
          {floppyCacheLoading ? (
            <p>Loading cache stats...</p>
          ) : floppyCacheStats ? (
            <div className={styles.cacheStats}>
              {/* Render Stats */}
              <h3>🖼️ Render Cache</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Total Entradas</h3>
                  <p className={styles.statNumber}>{floppyCacheStats.total}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Traits (1-9999)</h3>
                  <p className={styles.statNumber}>{floppyCacheStats.traits}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Floppys (10000+)</h3>
                  <p className={styles.statNumber}>{floppyCacheStats.floppys}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Serums (262144)</h3>
                  <p className={styles.statNumber}>{floppyCacheStats.serums}</p>
                </div>
              </div>
              
              <div className={styles.cacheActions}>
                <h3>🔄 Quick Actions</h3>
                <div className={styles.actionButtons}>
                  <button 
                    onClick={() => invalidateFloppyCache('invalidate_traits')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🎨 Refresh Traits (24h TTL)
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('invalidate_floppys')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    💾 Refresh Floppys (48h TTL)
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('invalidate_serum')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🧬 Refresh Serum (48h TTL)
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('clear_all')}
                    className={`${styles.actionButton} ${styles.dangerButton}`}
                    disabled={floppyCacheLoading}
                  >
                    🗑️ Clear All Floppy Cache
                  </button>
                </div>
                
                <h3>🎯 Targeted Refresh</h3>
                <div className={styles.refreshForm}>
                  <div className={styles.formGroup}>
                    <label>Single Token:</label>
                    <input
                      type="number"
                      placeholder="Token ID"
                      value={floppyRefreshForm.tokenId}
                      onChange={(e) => setFloppyRefreshForm({...floppyRefreshForm, tokenId: e.target.value})}
                      className={styles.formInput}
                    />
                    <button
                      onClick={() => invalidateFloppyCache('invalidate_token', { tokenId: floppyRefreshForm.tokenId })}
                      disabled={!floppyRefreshForm.tokenId || floppyCacheLoading}
                      className={styles.actionButton}
                    >
                      Refresh Token
                    </button>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Token Range:</label>
                    <input
                      type="number"
                      placeholder="Start ID"
                      value={floppyRefreshForm.startId}
                      onChange={(e) => setFloppyRefreshForm({...floppyRefreshForm, startId: e.target.value})}
                      className={styles.formInput}
                    />
                    <input
                      type="number"
                      placeholder="End ID"
                      value={floppyRefreshForm.endId}
                      onChange={(e) => setFloppyRefreshForm({...floppyRefreshForm, endId: e.target.value})}
                      className={styles.formInput}
                    />
                    <button
                      onClick={() => invalidateFloppyCache('invalidate_range', { 
                        startId: parseInt(floppyRefreshForm.startId), 
                        endId: parseInt(floppyRefreshForm.endId) 
                      })}
                      disabled={!floppyRefreshForm.startId || !floppyRefreshForm.endId || floppyCacheLoading}
                      className={styles.actionButton}
                    >
                      Refresh Range
                    </button>
                  </div>
                </div>
                
                <div className={styles.refreshButton}>
                  <button
                    onClick={fetchFloppyCacheStats}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🔄 Refresh Stats
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p>Error loading floppy cache stats</p>
          )}
        </div>

        {/* Nueva sección de administración de caché para AdrianZero render */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🎨 AdrianZero Render Cache Management</h2>
          
          {floppyCacheLoading ? (
            <p>Loading cache stats...</p>
          ) : adrianZeroCacheStats ? (
            <div className={styles.cacheStats}>
              <h3>🎨 AdrianZero Render Cache</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Total AdrianZero</h3>
                  <p className={styles.statNumber}>{adrianZeroCacheStats.stats.total}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Normal (1-9999)</h3>
                  <p className={styles.statNumber}>{adrianZeroCacheStats.stats.normal}</p>
                  <small>{adrianZeroCacheStats.ttlConfig.normal}</small>
                </div>
                <div className={styles.statCard}>
                  <h3>T-shirts (30000+)</h3>
                  <p className={styles.statNumber}>{adrianZeroCacheStats.stats.tshirts}</p>
                  <small>{adrianZeroCacheStats.ttlConfig.tshirts}</small>
                </div>
                <div className={styles.statCard}>
                  <h3>Serum (262144)</h3>
                  <p className={styles.statNumber}>{adrianZeroCacheStats.stats.serum}</p>
                  <small>{adrianZeroCacheStats.ttlConfig.serum}</small>
                </div>
              </div>
              
              <div className={styles.cacheActions}>
                <h3>🔄 Quick Actions</h3>
                <div className={styles.actionButtons}>
                  <button 
                    onClick={() => invalidateFloppyCache('invalidate_adrianzero_normal')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🎨 Refresh AdrianZero Normal (24h TTL)
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('invalidate_adrianzero_tshirts')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    👕 Refresh AdrianZero T-shirts (48h TTL)
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('invalidate_adrianzero_serum')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🧬 Refresh AdrianZero Serum (48h TTL)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p>Error loading AdrianZero cache stats</p>
          )}
        </div>

        {/* Nueva sección de administración de caché para contratos */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🔗 Contract Cache Management</h2>
          
          {floppyCacheLoading ? (
            <p>Loading cache stats...</p>
          ) : contractCacheStats ? (
            <div className={styles.cacheStats}>
              <h3>🔗 Contract Cache</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Total Entries</h3>
                  <p className={styles.statNumber}>{contractCacheStats.stats.totalEntries}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Valid Entries</h3>
                  <p className={styles.statNumber}>{contractCacheStats.stats.validEntries}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Expired Entries</h3>
                  <p className={styles.statNumber}>{contractCacheStats.stats.expiredEntries}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Memory Usage</h3>
                  <p className={styles.statNumber}>{contractCacheStats.stats.memoryUsage}</p>
                  <small>{contractCacheStats.ttlConfig.all}</small>
                </div>
              </div>
              
              <div className={styles.cacheActions}>
                <h3>🔄 Quick Actions</h3>
                <div className={styles.actionButtons}>
                  <button 
                    onClick={() => invalidateFloppyCache('clear_contract_cache')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🗑️ Clear All Contract Cache
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('cleanup_expired_contracts')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🧹 Cleanup Expired Contracts
                  </button>
                </div>
                
                <div className={styles.tokenForm}>
                  <h4>Clear Cache for Specific Token</h4>
                  <div className={styles.formRow}>
                    <input
                      type="number"
                      placeholder="Token ID"
                      value={floppyRefreshForm.tokenId}
                      onChange={(e) => setFloppyRefreshForm({...floppyRefreshForm, tokenId: e.target.value})}
                      className={styles.formInput}
                    />
                    <button
                      onClick={() => invalidateFloppyCache('clear_contract_cache_token', { tokenId: parseInt(floppyRefreshForm.tokenId) })}
                      disabled={!floppyRefreshForm.tokenId || floppyCacheLoading}
                      className={styles.actionButton}
                    >
                      Clear Token Cache
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p>Error loading contract cache stats</p>
          )}
        </div>

        {/* Nueva sección de administración de caché para JSON */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>📄 JSON Cache Management</h2>
          
          {floppyCacheLoading ? (
            <p>Loading cache stats...</p>
          ) : jsonCacheStats ? (
            <div className={styles.cacheStats}>
              <h3>📄 JSON Cache</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Total Files</h3>
                  <p className={styles.statNumber}>{jsonCacheStats.stats.totalFiles}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Valid Files</h3>
                  <p className={styles.statNumber}>{jsonCacheStats.stats.validFiles}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Expired Files</h3>
                  <p className={styles.statNumber}>{jsonCacheStats.stats.expiredFiles}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Memory Usage</h3>
                  <p className={styles.statNumber}>{jsonCacheStats.stats.memoryUsage}</p>
                  <small>{jsonCacheStats.ttlConfig.all}</small>
                </div>
              </div>
              
              <div className={styles.cacheActions}>
                <h3>🔄 Quick Actions</h3>
                <div className={styles.actionButtons}>
                  <button 
                    onClick={() => invalidateFloppyCache('clear_json_cache')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🗑️ Clear All JSON Cache
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('cleanup_expired_json')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🧹 Cleanup Expired JSON Files
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p>Error loading JSON cache stats</p>
          )}
        </div>

        {/* Nueva sección de administración de caché para SVG→PNG */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🖼️ SVG→PNG Cache Management</h2>
          
          {floppyCacheLoading ? (
            <p>Loading cache stats...</p>
          ) : svgPngCacheStats ? (
            <div className={styles.cacheStats}>
              <h3>🖼️ SVG→PNG Cache</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Total Conversions</h3>
                  <p className={styles.statNumber}>{svgPngCacheStats.stats.totalConversions}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Valid Conversions</h3>
                  <p className={styles.statNumber}>{svgPngCacheStats.stats.validConversions}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Expired Conversions</h3>
                  <p className={styles.statNumber}>{svgPngCacheStats.stats.expiredConversions}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Memory Usage</h3>
                  <p className={styles.statNumber}>{svgPngCacheStats.stats.memoryUsage}</p>
                  <small>{svgPngCacheStats.ttlConfig.all}</small>
                </div>
              </div>
              
              <div className={styles.cacheActions}>
                <h3>🔄 Quick Actions</h3>
                <div className={styles.actionButtons}>
                  <button 
                    onClick={() => invalidateFloppyCache('clear_svg_png_cache')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🗑️ Clear All SVG→PNG Cache
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('cleanup_expired_svg_png')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🧹 Cleanup Expired SVG→PNG
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p>Error loading SVG→PNG cache stats</p>
          )}
        </div>

        {/* Nueva sección de administración de caché para componentes */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🧩 Component Cache Management</h2>
          
          {floppyCacheLoading ? (
            <p>Loading cache stats...</p>
          ) : componentCacheStats ? (
            <div className={styles.cacheStats}>
              <h3>🧩 Component Cache</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Total Components</h3>
                  <p className={styles.statNumber}>{componentCacheStats.stats.totalComponents}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Valid Components</h3>
                  <p className={styles.statNumber}>{componentCacheStats.stats.validComponents}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Background</h3>
                  <p className={styles.statNumber}>{componentCacheStats.stats.backgroundComponents}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Skin</h3>
                  <p className={styles.statNumber}>{componentCacheStats.stats.skinComponents}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Traits</h3>
                  <p className={styles.statNumber}>{componentCacheStats.stats.traitComponents}</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Memory Usage</h3>
                  <p className={styles.statNumber}>{componentCacheStats.stats.memoryUsage}</p>
                  <small>{componentCacheStats.ttlConfig.all}</small>
                </div>
              </div>
              
              <div className={styles.cacheActions}>
                <h3>🔄 Quick Actions</h3>
                <div className={styles.actionButtons}>
                  <button 
                    onClick={() => invalidateFloppyCache('clear_component_cache')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🗑️ Clear All Component Cache
                  </button>
                  
                  <button 
                    onClick={() => invalidateFloppyCache('cleanup_expired_components')}
                    className={styles.actionButton}
                    disabled={floppyCacheLoading}
                  >
                    🧹 Cleanup Expired Components
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p>Error loading component cache stats</p>
          )}
        </div>

        {/* Nueva sección del generador de grids de AdrianZERO */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🎨 Generador de Grids - AdrianZERO</h2>
          
          <div className={styles.infoPanel}>
            <h3>ℹ️ Información del Tool</h3>
            <p><strong>Propósito:</strong> Generar grids de AdrianZERO para visualización y análisis</p>
            <p><strong>Optimizaciones:</strong> Reutiliza imágenes cacheadas, tamaño individual 64x64, formato JPEG comprimido</p>
            <p><strong>Límites:</strong> Máximo 10,000 tokens por grid, sin límite de tokens por fila</p>
          </div>

          {/* Formulario de Generación */}
          <div className={styles.cacheActions}>
            <h3>⚙️ Configuración del Grid</h3>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Token Inicial:</label>
                <input
                  type="number"
                  placeholder="1"
                  min="1"
                  value={gridForm.startToken}
                  onChange={(e) => setGridForm({...gridForm, startToken: e.target.value})}
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Token Final:</label>
                <input
                  type="number"
                  placeholder="300"
                  min="1"
                  value={gridForm.endToken}
                  onChange={(e) => setGridForm({...gridForm, endToken: e.target.value})}
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Tokens por Fila:</label>
                <input
                  type="number"
                  placeholder="10"
                  min="1"
                  value={gridForm.tokensPerRow}
                  onChange={(e) => setGridForm({...gridForm, tokensPerRow: e.target.value})}
                  className={styles.formInput}
                />
              </div>
            </div>
            
            <div className={styles.actionButtons}>
              <button
                onClick={generateGrid}
                className={styles.actionButton}
                disabled={gridLoading}
              >
                {gridLoading ? '⏳ Generando...' : '🚀 Generar Grid'}
              </button>
              <button
                onClick={() => {
                  setGridForm({ startToken: '1', endToken: '300', tokensPerRow: '10' });
                  setGridResult(null);
                  setGridStats(null);
                }}
                className={styles.actionButton}
                disabled={gridLoading}
              >
                🔄 Limpiar
              </button>
            </div>
          </div>

          {/* Estadísticas del Grid */}
          {gridStats && (
            <div className={styles.cacheStats}>
              <h3>📊 Estadísticas del Grid</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{gridStats.totalTokens}</div>
                  <div className={styles.statLabel}>Total Tokens</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{gridStats.cols}</div>
                  <div className={styles.statLabel}>Tokens por Fila</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{gridStats.rows}</div>
                  <div className={styles.statLabel}>Filas</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{gridStats.gridWidth}×{gridStats.gridHeight}</div>
                  <div className={styles.statLabel}>Tamaño Final</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>250×250</div>
                  <div className={styles.statLabel}>Tamaño Individual</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{Math.round((gridStats.gridWidth * gridStats.gridHeight * 3) / 1024)} KB</div>
                  <div className={styles.statLabel}>Tamaño Estimado</div>
                </div>
              </div>
            </div>
          )}

          {/* Resultado del Grid */}
          {gridResult && (
            <div className={styles.cacheActions}>
              <h3>🖼️ Grid Generado</h3>
              <div className={styles.gridPreview}>
                <img 
                  src={gridResult.imageUrl} 
                  alt="Grid generado" 
                  style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              {gridResult.gridInfo && (
                <div className={styles.infoPanel}>
                  <h4>📋 Información del Grid</h4>
                  <p><strong>Headers:</strong> {gridResult.gridInfo}</p>
                  <p><strong>Nota:</strong> Haz clic derecho en la imagen y selecciona "Guardar imagen como..." para descargarla</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nueva sección de Render Endpoints */}
        <div className={styles.adminSection}>
          <h2 className={styles.adminTitle}>🔗 Render Endpoints - Quick Access</h2>
          
          {/* Tags Toggle */}
          <div className={styles.tagsContainer}>
            <h3>🏷️ Filtrar por Tags:</h3>
            <div className={styles.tagsGrid}>
              {['adrianzero', 'custom', 'external', 'lambo', 'floppy', 'svg', 'test', 'metadata', 'traits'].map(tag => (
                <button
                  key={tag}
                  className={`${styles.tagButton} ${selectedTags.includes(tag) ? styles.tagActive : ''}`}
                  onClick={() => {
                    if (selectedTags.includes(tag)) {
                      setSelectedTags(selectedTags.filter(t => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <button
                className={styles.clearTagsButton}
                onClick={() => setSelectedTags([])}
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          {/* Buscador */}
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Buscar endpoint..."
              value={endpointSearch}
              onChange={(e) => setEndpointSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Lista de Endpoints */}
          <div className={styles.endpointsGrid}>
            {[
              {
                name: 'AdrianZERO Render',
                url: '/api/render/1',
                description: 'Render estándar de token AdrianZERO',
                tags: ['adrianzero', 'render'],
                example: '/api/render/1'
              },
              {
                name: 'AdrianZERO SVG',
                url: '/api/render/1.svg',
                description: 'Render SVG de token AdrianZERO',
                tags: ['adrianzero', 'svg', 'render'],
                example: '/api/render/1.svg'
              },
              {
                name: 'Custom Render',
                url: '/api/render/custom/1?eyes=7&mouth=22',
                description: 'Preview con traits modificados',
                tags: ['custom', 'render', 'adrianzero'],
                example: '/api/render/custom/1?eyes=7&mouth=22'
              },
              {
                name: 'Custom External Render',
                url: '/api/render/custom-external/1?eyes=7&mouth=22',
                description: 'Custom render usando servicio externo',
                tags: ['custom', 'external', 'render'],
                example: '/api/render/custom-external/1?eyes=7&mouth=22'
              },
              {
                name: 'Test External Render',
                url: '/api/render/test-external/1',
                description: 'Endpoint de prueba para render externo',
                tags: ['test', 'external', 'render'],
                example: '/api/render/test-external/1'
              },
              {
                name: 'Lambo Render',
                url: '/api/render/lambo/1?lambo=Lambo_Variant_Red',
                description: 'Render de AdrianZERO sobre Lambo',
                tags: ['lambo', 'render', 'adrianzero'],
                example: '/api/render/lambo/1?lambo=Lambo_Variant_Red'
              },
              {
                name: 'Floppy Render',
                url: '/api/render/floppy/18.png',
                description: 'Render de traits Floppy',
                tags: ['floppy', 'render', 'traits'],
                example: '/api/render/floppy/18.png'
              },
              {
                name: 'Floppy SVG',
                url: '/api/render/floppy/18.svg',
                description: 'Render SVG de traits Floppy',
                tags: ['floppy', 'svg', 'render', 'traits'],
                example: '/api/render/floppy/18.svg'
              },
              {
                name: 'AdrianZERO Metadata',
                url: '/api/metadata/1',
                description: 'Metadata de token AdrianZERO',
                tags: ['metadata', 'adrianzero'],
                example: '/api/metadata/1'
              },
              {
                name: 'Floppy Metadata',
                url: '/api/metadata/floppy/18.json',
                description: 'Metadata de traits Floppy',
                tags: ['metadata', 'floppy', 'traits'],
                example: '/api/metadata/floppy/18.json'
              },
              {
                name: 'Floppy Pack Metadata',
                url: '/api/metadata/floppy/10000',
                description: 'Metadata de pack Floppy',
                tags: ['metadata', 'floppy'],
                example: '/api/metadata/floppy/10000'
              },
              {
                name: 'Trait Render',
                url: '/api/trait/18',
                description: 'Render simplificado de trait individual',
                tags: ['traits', 'render'],
                example: '/api/trait/18'
              },
              {
                name: 'Trait Metadata',
                url: '/api/trait/metadata/18',
                description: 'Metadata simplificada de trait',
                tags: ['traits', 'metadata'],
                example: '/api/trait/metadata/18'
              },
              {
                name: 'Test Simple',
                url: '/api/test-simple/18',
                description: 'Endpoint de prueba simplificado',
                tags: ['test', 'traits'],
                example: '/api/test-simple/18'
              }
            ]
            .filter(endpoint => {
              // Filtrar por tags
              if (selectedTags.length > 0) {
                const hasAnyTag = selectedTags.some(tag => endpoint.tags.includes(tag));
                if (!hasAnyTag) return false;
              }
              // Filtrar por búsqueda
              if (endpointSearch) {
                const searchLower = endpointSearch.toLowerCase();
                return endpoint.name.toLowerCase().includes(searchLower) ||
                       endpoint.description.toLowerCase().includes(searchLower) ||
                       endpoint.example.toLowerCase().includes(searchLower);
              }
              return true;
            })
            .map((endpoint, index) => (
              <div key={index} className={styles.endpointCard}>
                <h3>{endpoint.name}</h3>
                <p className={styles.endpointDescription}>{endpoint.description}</p>
                <div className={styles.endpointTags}>
                  {endpoint.tags.map(tag => (
                    <span key={tag} className={styles.endpointTag}>{tag}</span>
                  ))}
                </div>
                <div className={styles.endpointExample}>
                  <code>{endpoint.example}</code>
                </div>
                <a 
                  href={endpoint.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.endpointLink}
                >
                  🔗 Abrir endpoint
                </a>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://adrianlab.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          🧪 AdrianLAB - {new Date().getFullYear()}
        </a>
      </footer>
    </div>
  );
} 