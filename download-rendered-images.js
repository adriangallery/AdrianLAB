#!/usr/bin/env node

/**
 * Script para descargar imágenes de floppies renderizadas desde el endpoint de Vercel
 * Endpoint: https://adrianlab.vercel.app/api/render/floppy/{floppyId}
 * 
 * Uso:
 * 1. Ejecuta: node download-rendered-images.js
 * 2. El script detecta automáticamente qué floppies descargar desde floppy.json
 * 3. Descarga en lotes de 10 con pausas para respetar límites de Vercel
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

function downloadImage(floppyId) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/api/render/floppy/${floppyId}`;
    const filePath = path.join(OUTPUT_DIR, `${floppyId}.png`);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          console.log(`✅ Floppy ${floppyId} descargado: ${filePath}`);
          resolve();
        });
      } else if (response.statusCode === 404) {
        console.log(`⚠️  Floppy ${floppyId} no encontrado`);
        resolve(); // No fallar, solo continuar
      } else {
        console.error(`❌ Error descargando floppy ${floppyId}: ${response.statusCode}`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (error) => {
      console.error(`❌ Error de conexión para floppy ${floppyId}:`, error.message);
      reject(error);
    });
  });
}

// Configuración
const BATCH_SIZE = 10; // Descargar 10 a la vez

// Consultar los floppies desde floppy.json
function getFloppiesFromJson() {
  const floppyPath = path.join(process.cwd(), 'public', 'labmetadata', 'floppy.json');
  const floppyData = JSON.parse(fs.readFileSync(floppyPath, 'utf-8'));
  return floppyData.floppys.map(f => f.tokenId);
}

// Verificar qué floppies ya están descargados
function getDownloadedFloppies() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR)
    .filter(file => file.endsWith('.png'))
    .map(file => parseInt(file.replace('.png', '')))
    .filter(id => !isNaN(id));
}

async function main() {
  console.log(`🎨 Script de descarga de floppies`);
  console.log(`📁 Directorio de salida: ${OUTPUT_DIR}\n`);
  
  const allFloppies = getFloppiesFromJson();
  const downloadedFloppies = getDownloadedFloppies();
  const pendingFloppies = allFloppies.filter(id => !downloadedFloppies.includes(id)).sort((a, b) => a - b);
  
  console.log(`📊 Total de floppies en el JSON: ${allFloppies.length}`);
  console.log(`✅ Ya descargados: ${downloadedFloppies.length}`);
  console.log(`⏳ Pendientes: ${pendingFloppies.length}`); 
  if (pendingFloppies.length === 0) {
    console.log(`\n🎉 ¡Todos los floppies ya están descargados!`);
    return;
  }
  
  // Procesar en lotes de 10
  console.log(`\n📦 Procesando en lotes de ${BATCH_SIZE}...\n`);
  
  for (let i = 0; i < pendingFloppies.length; i += BATCH_SIZE) {
    const batch = pendingFloppies.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pendingFloppies.length / BATCH_SIZE);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 LOTE ${batchNumber}/${totalBatches} - IDs: ${batch.join(', ')}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    for (const floppyId of batch) {
      try {
        await downloadImage(floppyId);
        // Pausa de 2 segundos entre descargas
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Falló la descarga del floppy ${floppyId}`);
      }
    }
    
    console.log(`\n✅ Lote ${batchNumber} completado.`);
    
    // Pausa de 30 segundos entre lotes
    if (i + BATCH_SIZE < pendingFloppies.length) {
      console.log(`⏸️  Pausando 30 segundos antes del siguiente lote...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  console.log(`\n🎉 Todos los floppies descargados en: ${OUTPUT_DIR}`);
}

main().catch(console.error);

