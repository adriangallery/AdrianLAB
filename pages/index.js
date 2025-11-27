import Head from 'next/head';
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {

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
    // Component mounted
  }, []);


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