import Head from 'next/head';
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [traits, setTraits] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const traitsPerPage = 6;

  useEffect(() => {
    loadTraits();
  }, []);

  const loadTraits = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/metadata/floppy/1');
      if (response.ok) {
        // Cargar traits del 1 al 50 para la demo
        const traitsData = [];
        for (let i = 1; i <= 50; i++) {
          traitsData.push({
            id: i,
            name: `Trait #${i}`,
            imageUrl: `/api/render/floppy/${i}.png?v=${Date.now()}`
          });
        }
        setTraits(traitsData);
      }
    } catch (error) {
      console.error('Error loading traits:', error);
    }
    setLoading(false);
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