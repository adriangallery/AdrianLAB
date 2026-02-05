#!/usr/bin/env node

/**
 * Script para descargar imágenes de traits renderizadas (versión simplificada)
 * Endpoint: https://adrianlab.vercel.app/api/render/floppy/{tokenId}?simple=true
 *
 * Uso:
 * 1. Ejecuta: node download-rendered-images.js
 * 2. El script detecta automáticamente qué traits descargar desde traits.json
 * 3. Descarga en lotes de 5 con pausas para respetar límites de Vercel
 * 4. Las imágenes se guardarán en: rendered-images/{id}.png
 * 5. Si se interrumpe, puedes ejecutarlo de nuevo y continuará desde donde quedó
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://adrianlab.vercel.app';
const OUTPUT_DIR = path.join(process.cwd(), 'rendered-images');

// Crear directorio de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function downloadImage(tokenId) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/api/render/floppy/${tokenId}?simple=true`;
    const filePath = path.join(OUTPUT_DIR, `${tokenId}.png`);

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          console.log(`✅ Trait ${tokenId} descargado: ${filePath}`);
          resolve(true);
        });
      } else if (response.statusCode === 404) {
        console.log(`⚠️  Trait ${tokenId} no encontrado`);
        resolve(false);
      } else {
        console.error(`❌ Error descargando trait ${tokenId}: ${response.statusCode}`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (error) => {
      console.error(`❌ Error de conexión para trait ${tokenId}:`, error.message);
      reject(error);
    });
  });
}

// Configuración
const BATCH_SIZE = 5; // Descargar 5 a la vez (test-simple es más pesado)
const DELAY_BETWEEN_DOWNLOADS = 3000; // 3 segundos entre descargas
const DELAY_BETWEEN_BATCHES = 15000; // 15 segundos entre lotes

// Consultar los traits desde traits.json
function getTraitsFromJson() {
  const traitsPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
  const traitsData = JSON.parse(fs.readFileSync(traitsPath, 'utf-8'));
  return traitsData.traits.map(t => t.tokenId).sort((a, b) => a - b);
}

// Verificar qué traits ya están descargados
function getDownloadedTraits() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR)
    .filter(file => file.endsWith('.png'))
    .map(file => parseInt(file.replace('.png', '')))
    .filter(id => !isNaN(id));
}

async function main() {
  console.log(`🎨 Script de descarga de traits simplificados`);
  console.log(`📁 Directorio de salida: ${OUTPUT_DIR}`);
  console.log(`🌐 Endpoint: ${BASE_URL}/api/render/floppy/{tokenId}?simple=true\n`);

  const allTraits = getTraitsFromJson();
  const downloadedTraits = getDownloadedTraits();
  const pendingTraits = allTraits.filter(id => !downloadedTraits.includes(id)).sort((a, b) => a - b);

  console.log(`📊 Total de traits en traits.json: ${allTraits.length}`);
  console.log(`✅ Ya descargados: ${downloadedTraits.length}`);
  console.log(`⏳ Pendientes: ${pendingTraits.length}`);

  if (pendingTraits.length === 0) {
    console.log(`\n🎉 ¡Todos los traits ya están descargados!`);
    return;
  }

  console.log(`\n📋 IDs pendientes (primeros 20): ${pendingTraits.slice(0, 20).join(', ')}${pendingTraits.length > 20 ? '...' : ''}`);

  // Procesar en lotes
  console.log(`\n📦 Procesando en lotes de ${BATCH_SIZE}...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pendingTraits.length; i += BATCH_SIZE) {
    const batch = pendingTraits.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pendingTraits.length / BATCH_SIZE);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 LOTE ${batchNumber}/${totalBatches} - IDs: ${batch.join(', ')}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    for (const tokenId of batch) {
      try {
        const success = await downloadImage(tokenId);
        if (success) successCount++;
        else failCount++;
        // Pausa entre descargas
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DOWNLOADS));
      } catch (error) {
        console.error(`❌ Falló la descarga del trait ${tokenId}`);
        failCount++;
      }
    }

    console.log(`\n✅ Lote ${batchNumber} completado. (Total: ${successCount} éxitos, ${failCount} fallos)`);

    // Pausa entre lotes
    if (i + BATCH_SIZE < pendingTraits.length) {
      console.log(`⏸️  Pausando ${DELAY_BETWEEN_BATCHES/1000} segundos antes del siguiente lote...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log(`\n🎉 Descarga completada!`);
  console.log(`✅ Éxitos: ${successCount}`);
  console.log(`❌ Fallos: ${failCount}`);
  console.log(`📁 Directorio: ${OUTPUT_DIR}`);
}

main().catch(console.error);
