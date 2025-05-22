import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>AdrianLAB Renderer</title>
        <meta name="description" content="AdrianLAB NFT Renderer and Metadata" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className={styles.highlight}>AdrianLAB</span>
        </h1>

        <p className={styles.description}>
          Rendering and metadata server for AdrianLAB NFT collection
        </p>

        <div className={styles.grid}>
          <a href="/api/render/1" className={styles.card}>
            <h2>Rendering &rarr;</h2>
            <p>API for token rendering. Example: /api/render/1</p>
          </a>

          <a href="/api/metadata/1" className={styles.card}>
            <h2>Metadata &rarr;</h2>
            <p>API for token metadata. Example: /api/metadata/1</p>
          </a>
          
          <a href="/api/trait/1" className={styles.card}>
            <h2>Traits &rarr;</h2>
            <p>API for individual trait visualization. Example: /api/trait/1</p>
          </a>
          
          <a href="/api/trait/metadata/1" className={styles.card}>
            <h2>Trait Metadata &rarr;</h2>
            <p>API for trait metadata. Example: /api/trait/metadata/1</p>
          </a>
          
          <a href="/api/traits/preview/1" className={styles.card}>
            <h2>Pack Preview &rarr;</h2>
            <p>API for viewing traits in a pack. Example: /api/traits/preview/1</p>
          </a>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://adrianlab.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          AdrianLAB - {new Date().getFullYear()}
        </a>
      </footer>
    </div>
  );
} 