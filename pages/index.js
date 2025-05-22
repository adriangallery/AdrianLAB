import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>AdrianLAB Renderer</title>
        <meta name="description" content="AdrianLAB NFT Renderer y Metadatos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Bienvenido a <span className={styles.highlight}>AdrianLAB</span>
        </h1>

        <p className={styles.description}>
          Servidor de renderizado y metadatos para la colección AdrianLAB NFT
        </p>

        <div className={styles.grid}>
          <a href="/api/render/1" className={styles.card}>
            <h2>Renderizado &rarr;</h2>
            <p>API para renderizar tokens. Ejemplo: /api/render/1</p>
          </a>

          <a href="/api/metadata/1" className={styles.card}>
            <h2>Metadatos &rarr;</h2>
            <p>API para obtener metadatos. Ejemplo: /api/metadata/1</p>
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