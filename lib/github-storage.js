/**
 * Sistema de almacenamiento en GitHub para renders con toggle activo
 * Verifica onchain si el toggle está activo antes de renderizar
 */

import { Octokit } from '@octokit/rest';
import { getRenderFilename, getTraitFilename, getFloppySimpleFilename, getFloppyGifFilename, getCustomRenderFilename } from './render-hash.js';

// Configuración de GitHub
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'adriangallery';
const GITHUB_REPO = process.env.GITHUB_REPO || 'AdrianLAB';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_STORAGE_PATH = process.env.GITHUB_STORAGE_PATH || 'public/rendered-toggles';
const GITHUB_TRAITS_STORAGE_PATH = 'public/rendered-traits';
const GITHUB_CUSTOM_STORAGE_PATH = 'public/rendered-custom';

// Inicializar Octokit
let octokit = null;

function getOctokit() {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error(`[github-storage] ❌ GITHUB_TOKEN no está configurada`);
      throw new Error('GITHUB_TOKEN no está configurada en las variables de entorno');
    }
    console.log(`[github-storage] ✅ GITHUB_TOKEN encontrada, inicializando Octokit`);
    octokit = new Octokit({ auth: token });
    console.log(`[github-storage] ✅ Octokit inicializado correctamente`);
  }
  return octokit;
}

/**
 * Shared helper: check if a file exists in GitHub with 1 retry on transient errors.
 * Returns true/false for definitive results, retries once on network/rate-limit errors.
 * On persistent failure after retry, returns false (but logs loudly).
 */
async function _checkGitHubFileExists(octokit, filePath, attempt = 0) {
  try {
    await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      ref: GITHUB_BRANCH
    });
    console.log(`[github-storage] ✅ Existe: ${filePath}`);
    return true;
  } catch (error) {
    if (error.status === 404) {
      // Definitive: file does not exist
      return false;
    }
    // Transient error (rate-limit 403, network timeout, 500, etc.)
    if (attempt === 0) {
      console.warn(`[github-storage] ⚠️ Transient error checking ${filePath} (status=${error.status}), retrying in 500ms...`);
      await new Promise(r => setTimeout(r, 500));
      return _checkGitHubFileExists(octokit, filePath, 1);
    }
    // Second attempt also failed — log loudly but return false to allow render fallback
    console.error(`[github-storage] ❌ PERSISTENT ERROR checking ${filePath} after retry (status=${error.status}): ${error.message}. Falling through to render.`);
    return false;
  }
}

/**
 * Verifica si un archivo ya existe en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} renderType - Tipo de render ('closeup', 'shadow', 'glow', 'bn', 'uv', 'blackout', 'banana', 'normal')
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHub(tokenId, renderType = 'normal') {
  const octokit = getOctokit();

  // Construir nombre de archivo según el tipo de render
  let fileName;
  if (renderType === 'closeup') {
    fileName = `${tokenId}_closeup.png`;
  } else if (renderType === 'shadow') {
    fileName = `${tokenId}_shadow.png`;
  } else if (renderType === 'glow') {
    fileName = `${tokenId}_glow.png`;
  } else if (renderType === 'bn') {
    fileName = `${tokenId}_bn.png`;
  } else if (renderType === 'uv') {
    fileName = `${tokenId}_uv.png`;
  } else if (renderType === 'blackout') {
    fileName = `${tokenId}_blackout.png`;
  } else if (renderType === 'banana') {
    fileName = `${tokenId}_banana.png`;
  } else {
    fileName = `${tokenId}.png`;
  }

  const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
  return _checkGitHubFileExists(octokit, filePath);
}

/**
 * Sube un archivo a GitHub
 * @param {string} tokenId - ID del token
 * @param {Buffer} imageBuffer - Buffer de la imagen PNG
 * @param {string} renderType - Tipo de render ('closeup', 'shadow', 'glow', 'bn', 'uv', 'blackout', 'banana', 'normal')
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadFileToGitHub(tokenId, imageBuffer, renderType = 'normal') {
  try {
    console.log(`[github-storage] 📤 Iniciando subida a GitHub: token ${tokenId}, tipo ${renderType}`);
    const octokit = getOctokit();
    
    // Construir nombre de archivo según el tipo de render
    let fileName;
    if (renderType === 'closeup') {
      fileName = `${tokenId}_closeup.png`;
    } else if (renderType === 'shadow') {
      fileName = `${tokenId}_shadow.png`;
    } else if (renderType === 'glow') {
      fileName = `${tokenId}_glow.png`;
    } else if (renderType === 'bn') {
      fileName = `${tokenId}_bn.png`;
    } else if (renderType === 'uv') {
      fileName = `${tokenId}_uv.png`;
    } else if (renderType === 'blackout') {
      fileName = `${tokenId}_blackout.png`;
    } else if (renderType === 'banana') {
      fileName = `${tokenId}_banana.png`;
    } else {
      fileName = `${tokenId}.png`;
    }
    
    const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    const content = imageBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${imageBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Archivo existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo archivo: ${filePath}`);
    }
    
    // Subir o actualizar el archivo
    const commitMessage = `Upload render ${fileName} for token ${tokenId}${renderType !== 'normal' ? ` (${renderType})` : ''}`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    // Si el archivo existe, incluir SHA para actualizar
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo archivo a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Archivo subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo archivo a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Obtiene la URL del archivo en GitHub (raw)
 * @param {string} tokenId - ID del token
 * @param {string} renderType - Tipo de render
 * @returns {string} - URL del archivo
 */
export function getGitHubFileUrl(tokenId, renderType = 'normal') {
  // Construir nombre de archivo según el tipo de render
  let fileName;
  if (renderType === 'closeup') {
    fileName = `${tokenId}_closeup.png`;
  } else if (renderType === 'shadow') {
    fileName = `${tokenId}_shadow.png`;
  } else if (renderType === 'glow') {
    fileName = `${tokenId}_glow.png`;
  } else if (renderType === 'bn') {
    fileName = `${tokenId}_bn.png`;
  } else if (renderType === 'uv') {
    fileName = `${tokenId}_uv.png`;
  } else if (renderType === 'blackout') {
    fileName = `${tokenId}_blackout.png`;
  } else if (renderType === 'banana') {
    fileName = `${tokenId}_banana.png`;
  } else {
    fileName = `${tokenId}.png`;
  }
  
  const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Determina el tipo de render basado en los parámetros
 * @param {boolean} isCloseup - Si es closeup
 * @param {boolean} isShadow - Si tiene shadow
 * @param {boolean} isGlow - Si tiene glow
 * @param {boolean} isBn - Si es blanco y negro
 * @param {boolean} isUv - Si tiene UV
 * @param {boolean} isBlackout - Si tiene blackout
 * @param {boolean} isBanana - Si tiene banana
 * @returns {string} - Tipo de render
 */
export function getRenderType(isCloseup, isShadow, isGlow, isBn, isUv, isBlackout, isBanana) {
  // Prioridad: banana > blackout > uv > bn > glow > shadow > closeup > normal
  if (isBanana) return 'banana';
  if (isBlackout) return 'blackout';
  if (isUv) return 'uv';
  if (isBn) return 'bn';
  if (isGlow) return 'glow';
  if (isShadow) return 'shadow';
  if (isCloseup) return 'closeup';
  return 'normal';
}

/**
 * Verifica si un archivo con hash específico existe en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHubByHash(tokenId, hash) {
  const octokit = getOctokit();
  const fileName = getRenderFilename(tokenId, hash);
  const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
  return _checkGitHubFileExists(octokit, filePath);
}

/**
 * Obtiene la URL del archivo en GitHub por hash
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @returns {string} - URL del archivo
 */
export function getGitHubFileUrlByHash(tokenId, hash) {
  const fileName = getRenderFilename(tokenId, hash);
  const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Sube un archivo a GitHub usando hash
 * @param {string} tokenId - ID del token
 * @param {Buffer} imageBuffer - Buffer de la imagen PNG
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadFileToGitHubByHash(tokenId, imageBuffer, hash) {
  try {
    console.log(`[github-storage] 📤 Iniciando subida a GitHub por hash: token ${tokenId}, hash ${hash}`);
    const octokit = getOctokit();
    
    const fileName = getRenderFilename(tokenId, hash);
    const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    
    const content = imageBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${imageBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Archivo existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo archivo: ${filePath}`);
    }
    
    // Subir o actualizar el archivo
    const commitMessage = `Upload render ${fileName} for token ${tokenId} (hash: ${hash})`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    // Si el archivo existe, incluir SHA para actualizar
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo archivo a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Archivo subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo archivo por hash a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Verifica si un trait renderizado existe en GitHub
 * @param {string} traitId - ID del trait
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHubTrait(traitId, hash) {
  try {
    const octokit = getOctokit();
    const fileName = getTraitFilename(traitId, hash);
    const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
    
    try {
      const response = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      
      console.log(`[github-storage] ✅ Trait con hash existe en GitHub: ${filePath}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        console.log(`[github-storage] ❌ Trait con hash no existe en GitHub: ${filePath}`);
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error verificando trait por hash en GitHub:`, error.message);
    return false;
  }
}

/**
 * Obtiene la URL del trait en GitHub
 * @param {string} traitId - ID del trait
 * @param {string} hash - Hash único del render
 * @returns {string} - URL del archivo
 */
export function getGitHubFileUrlTrait(traitId, hash) {
  const fileName = getTraitFilename(traitId, hash);
  const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Sube un trait renderizado a GitHub
 * @param {string} traitId - ID del trait
 * @param {Buffer} imageBuffer - Buffer de la imagen PNG
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadFileToGitHubTrait(traitId, imageBuffer, hash) {
  try {
    console.log(`[github-storage] 📤 Iniciando subida de trait a GitHub: traitId ${traitId}, hash ${hash}`);
    const octokit = getOctokit();
    
    const fileName = getTraitFilename(traitId, hash);
    const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    
    const content = imageBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${imageBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Trait existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo trait: ${filePath}`);
    }
    
    // Subir o actualizar el archivo
    const commitMessage = `Upload trait render ${fileName} for traitId ${traitId} (hash: ${hash})`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    // Si el archivo existe, incluir SHA para actualizar
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo trait a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Trait subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo trait a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Verifica si un floppy simple renderizado existe en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHubFloppySimple(tokenId, hash) {
  try {
    const octokit = getOctokit();
    const fileName = getFloppySimpleFilename(tokenId, hash);
    const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
    
    try {
      const response = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      
      console.log(`[github-storage] ✅ Floppy simple con hash existe en GitHub: ${filePath}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        console.log(`[github-storage] ❌ Floppy simple con hash no existe en GitHub: ${filePath}`);
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error verificando floppy simple por hash en GitHub:`, error.message);
    return false;
  }
}

/**
 * Obtiene la URL del floppy simple en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @returns {string} - URL del archivo
 */
export function getGitHubFileUrlFloppySimple(tokenId, hash) {
  const fileName = getFloppySimpleFilename(tokenId, hash);
  const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Sube un floppy simple renderizado a GitHub
 * @param {string} tokenId - ID del token
 * @param {Buffer} imageBuffer - Buffer de la imagen PNG
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadFileToGitHubFloppySimple(tokenId, imageBuffer, hash) {
  try {
    console.log(`[github-storage] 📤 Iniciando subida de floppy simple a GitHub: tokenId ${tokenId}, hash ${hash}`);
    const octokit = getOctokit();
    
    const fileName = getFloppySimpleFilename(tokenId, hash);
    const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    
    const content = imageBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${imageBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Floppy simple existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo floppy simple: ${filePath}`);
    }
    
    // Subir o actualizar el archivo
    const commitMessage = `Upload floppy simple render ${fileName} for tokenId ${tokenId} (hash: ${hash})`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    // Si el archivo existe, incluir SHA para actualizar
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo floppy simple a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Floppy simple subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo floppy simple a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Verifica si un GIF de floppy animado existe en GitHub
 * @param {string|number} traitId - ID del trait
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHubFloppyGif(traitId, hash) {
  try {
    const octokit = getOctokit();
    const fileName = getFloppyGifFilename(traitId, hash);
    const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
    
    try {
      const response = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      
      console.log(`[github-storage] ✅ GIF de floppy con hash existe en GitHub: ${filePath}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        console.log(`[github-storage] ❌ GIF de floppy con hash no existe en GitHub: ${filePath}`);
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error verificando GIF de floppy por hash en GitHub:`, error.message);
    return false;
  }
}

/**
 * Obtiene la URL del GIF de floppy en GitHub
 * @param {string|number} traitId - ID del trait
 * @param {string} hash - Hash único del render
 * @returns {string} - URL del archivo
 */
export function getGitHubFileUrlFloppyGif(traitId, hash) {
  const fileName = getFloppyGifFilename(traitId, hash);
  const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Sube un GIF de floppy animado a GitHub
 * @param {string|number} traitId - ID del trait
 * @param {Buffer} gifBuffer - Buffer del GIF
 * @param {string} hash - Hash único del render
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadFileToGitHubFloppyGif(traitId, gifBuffer, hash) {
  try {
    console.log(`[github-storage] 📤 Iniciando subida de GIF de floppy a GitHub: traitId ${traitId}, hash ${hash}`);
    const octokit = getOctokit();
    
    const fileName = getFloppyGifFilename(traitId, hash);
    const filePath = `${GITHUB_TRAITS_STORAGE_PATH}/${fileName}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    
    const content = gifBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${gifBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 GIF de floppy existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo GIF de floppy: ${filePath}`);
    }
    
    // Subir o actualizar el archivo
    const commitMessage = `Upload floppy GIF ${fileName} for traitId ${traitId} (hash: ${hash})`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    // Si el archivo existe, incluir SHA para actualizar
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo GIF de floppy a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ GIF de floppy subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo GIF de floppy a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Elimina un archivo de GitHub
 * @param {string} filePath - Ruta completa del archivo en GitHub
 * @param {string} reason - Razón de la eliminación (para el commit message)
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
export async function deleteFileFromGitHub(filePath, reason = 'Invalidación manual') {
  try {
    console.log(`[github-storage] 🗑️  Iniciando eliminación de archivo: ${filePath}`);
    const octokit = getOctokit();
    
    // Obtener el SHA del archivo (necesario para eliminarlo)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Archivo encontrado, SHA: ${sha}`);
    } catch (error) {
      if (error.status === 404) {
        console.log(`[github-storage] ⚠️  Archivo no existe: ${filePath}`);
        return false; // Archivo no existe, no hay nada que eliminar
      }
      throw error;
    }
    
    // Eliminar el archivo
    const commitMessage = `Delete ${filePath} - ${reason}`;
    
    const deleteParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      sha: sha,
      branch: GITHUB_BRANCH
    };
    
    console.log(`[github-storage] 🗑️  Eliminando archivo de GitHub...`);
    const response = await octokit.repos.deleteFile(deleteParams);
    
    console.log(`[github-storage] ✅ Archivo eliminado exitosamente de GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error eliminando archivo de GitHub:`, error.message);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    return false;
  }
}

/**
 * Obtiene la URL de un asset de labimages desde GitHub raw
 * @param {string} assetPath - Ruta del asset (ej: 'ogpunks/100001.svg' o 'bedrooms/assets/Layer_3_Floor.png')
 * @returns {string} - URL del archivo en GitHub raw
 */
export function getGitHubLabimagesUrl(assetPath) {
  const filePath = `public/labimages/${assetPath}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Sube un archivo directamente a labimages en GitHub
 * @param {string} assetPath - Ruta del asset (ej: '10017.gif' o 'ogpunks/100001.svg')
 * @param {Buffer} fileBuffer - Buffer del archivo a subir
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadLabimagesAsset(assetPath, fileBuffer) {
  try {
    console.log(`[github-storage] 📤 Iniciando subida de asset a labimages: ${assetPath}`);
    const octokit = getOctokit();
    
    const filePath = `public/labimages/${assetPath}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    
    const content = fileBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${fileBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Asset existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo asset: ${filePath}`);
    }
    
    // Subir o actualizar el archivo
    const commitMessage = `Upload labimages asset: ${assetPath}`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    // Si el archivo existe, incluir SHA para actualizar
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo asset a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Asset subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo asset a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Carga un asset de labimages con fallback a GitHub
 * Intenta primero desde filesystem local, luego desde GitHub raw
 * @param {string} assetPath - Ruta del asset (ej: 'ogpunks/100001.svg' o 'bedrooms/assets/Layer_3_Floor.png')
 * @returns {Promise<Buffer|null>} - Buffer del asset o null si no se encuentra
 */
export async function loadLabimagesAsset(assetPath) {
  const path = await import('path');
  const fs = await import('fs');
  
  // 1. Intentar desde filesystem local (si existe en build)
  const localPath = path.default.join(process.cwd(), 'public', 'labimages', assetPath);
  try {
    if (fs.default.existsSync(localPath)) {
      const buffer = fs.default.readFileSync(localPath);
      console.log(`[github-storage] ✅ Asset cargado desde filesystem: ${assetPath}`);
      return buffer;
    }
  } catch (error) {
    console.log(`[github-storage] ⚠️ Asset no encontrado en filesystem: ${assetPath}, intentando GitHub...`);
  }
  
  // 2. Fallback a GitHub raw
  try {
    const githubUrl = getGitHubLabimagesUrl(assetPath);
    console.log(`[github-storage] 📥 Descargando asset desde GitHub: ${githubUrl}`);
    
    const response = await fetch(githubUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[github-storage] ✅ Asset cargado desde GitHub: ${assetPath}`);
      return buffer;
    } else {
      console.warn(`[github-storage] ❌ Asset no encontrado en GitHub (${response.status}): ${assetPath}`);
      return null;
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error cargando asset desde GitHub: ${assetPath}`, error.message);
    return null;
  }
}

/**
 * Elimina todos los renders de un token de GitHub (normal, closeup, shadow, banana, etc. y hash-based)
 * @param {string} tokenId - ID del token
 * @returns {Promise<Object>} - Objeto con el resultado de cada eliminación
 */
export async function deleteAllRendersForToken(tokenId) {
  const results = {
    tokenId,
    deleted: [],
    notFound: [],
    errors: []
  };
  
  // Lista de tipos de render a eliminar (toggle-based)
  const renderTypes = ['normal', 'closeup', 'shadow', 'glow', 'bn', 'uv', 'blackout', 'banana'];
  
  for (const renderType of renderTypes) {
    try {
      let fileName;
      if (renderType === 'closeup') {
        fileName = `${tokenId}_closeup.png`;
      } else if (renderType === 'shadow') {
        fileName = `${tokenId}_shadow.png`;
      } else if (renderType === 'glow') {
        fileName = `${tokenId}_glow.png`;
      } else if (renderType === 'bn') {
        fileName = `${tokenId}_bn.png`;
      } else if (renderType === 'uv') {
        fileName = `${tokenId}_uv.png`;
      } else if (renderType === 'blackout') {
        fileName = `${tokenId}_blackout.png`;
      } else if (renderType === 'banana') {
        fileName = `${tokenId}_banana.png`;
      } else {
        fileName = `${tokenId}.png`;
      }
      
      const filePath = `${GITHUB_STORAGE_PATH}/${fileName}`;
      const deleted = await deleteFileFromGitHub(filePath, `Invalidación manual para token ${tokenId}`);
      
      if (deleted) {
        results.deleted.push(renderType);
      } else {
        results.notFound.push(renderType);
      }
    } catch (error) {
      console.error(`[github-storage] ❌ Error eliminando ${renderType} para token ${tokenId}:`, error.message);
      results.errors.push({ type: renderType, error: error.message });
    }
  }
  
  // También intentar eliminar renders con hash (buscar por patrón)
  try {
    const octokit = getOctokit();
    const directoryContent = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_STORAGE_PATH,
      ref: GITHUB_BRANCH
    });
    
    if (Array.isArray(directoryContent.data)) {
      const tokenFiles = directoryContent.data.filter(file => 
        file.name.startsWith(`${tokenId}_`) && file.name.endsWith('.png')
      );
      
      for (const file of tokenFiles) {
        const filePath = `${GITHUB_STORAGE_PATH}/${file.name}`;
        const deleted = await deleteFileFromGitHub(filePath, `Invalidación manual para token ${tokenId} (hash-based)`);
        if (deleted) {
          results.deleted.push(`hash-${file.name}`);
        }
      }
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error buscando archivos con hash para token ${tokenId}:`, error.message);
  }
  
  return results;
}

/**
 * Verifica si un render custom existe en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @param {boolean} isGif - Si es GIF o PNG
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHubCustom(tokenId, hash, isGif = false) {
  try {
    const octokit = getOctokit();
    const fileName = getCustomRenderFilename(tokenId, hash, isGif);
    const filePath = `${GITHUB_CUSTOM_STORAGE_PATH}/${fileName}`;

    try {
      await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      console.log(`[github-storage] ✅ Custom render con hash existe en GitHub: ${filePath}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        console.log(`[github-storage] ❌ Custom render con hash no existe en GitHub: ${filePath}`);
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error verificando custom render por hash en GitHub:`, error.message);
    return false;
  }
}

/**
 * Obtiene la URL del render custom en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @param {boolean} isGif - Si es GIF o PNG
 * @returns {string} - URL del archivo
 */
export function getGitHubFileUrlCustom(tokenId, hash, isGif = false) {
  const fileName = getCustomRenderFilename(tokenId, hash, isGif);
  const filePath = `${GITHUB_CUSTOM_STORAGE_PATH}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`;
}

/**
 * Sube un render custom a GitHub
 * @param {string} tokenId - ID del token
 * @param {Buffer} imageBuffer - Buffer de la imagen (PNG o GIF)
 * @param {string} hash - Hash único del render
 * @param {boolean} isGif - Si es GIF o PNG
 * @returns {Promise<boolean>} - true si se subió correctamente
 */
export async function uploadFileToGitHubCustom(tokenId, imageBuffer, hash, isGif = false) {
  try {
    console.log(`[github-storage] 📤 Iniciando subida de custom render a GitHub: tokenId ${tokenId}, hash ${hash}, isGif ${isGif}`);
    const octokit = getOctokit();
    
    const fileName = getCustomRenderFilename(tokenId, hash, isGif);
    const filePath = `${GITHUB_CUSTOM_STORAGE_PATH}/${fileName}`;
    console.log(`[github-storage] 📤 Ruta completa del archivo: ${filePath}`);
    
    const content = imageBuffer.toString('base64');
    console.log(`[github-storage] 📤 Tamaño del buffer: ${imageBuffer.length} bytes, base64: ${content.length} caracteres`);
    
    let sha = null;
    try {
      const existingFile = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      sha = existingFile.data.sha;
      console.log(`[github-storage] 📝 Custom render existe, actualizando: ${filePath}`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[github-storage] 📤 Creando nuevo custom render: ${filePath}`);
    }
    
    const commitMessage = `Upload custom render ${fileName} for tokenId ${tokenId} (hash: ${hash})`;
    
    const uploadParams = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: GITHUB_BRANCH
    };
    
    if (sha) {
      uploadParams.sha = sha;
    }
    
    console.log(`[github-storage] 📤 Subiendo custom render a GitHub...`);
    const response = await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Custom render subido exitosamente a GitHub: ${filePath}`);
    console.log(`[github-storage] ✅ Commit SHA: ${response.data.commit.sha}`);
    console.log(`[github-storage] ✅ URL del commit: ${response.data.commit.html_url}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo custom render a GitHub:`, error.message);
    console.error(`[github-storage] ❌ Error completo:`, error);
    if (error.status) {
      console.error(`[github-storage] ❌ Status code: ${error.status}`);
    }
    if (error.response) {
      console.error(`[github-storage] ❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}
