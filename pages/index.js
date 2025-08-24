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
      
      // Pagers (15000-15004)
      for (let i = 15000; i <= 15004; i++) {
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