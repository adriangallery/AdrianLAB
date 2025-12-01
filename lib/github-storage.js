/**
 * Sistema de almacenamiento en GitHub para renders con toggle activo
 * Verifica onchain si el toggle está activo antes de renderizar
 */

import { Octokit } from '@octokit/rest';

// Configuración de GitHub
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'adriangallery';
const GITHUB_REPO = process.env.GITHUB_REPO || 'AdrianLAB';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_STORAGE_PATH = process.env.GITHUB_STORAGE_PATH || 'public/rendered-toggles';

// Inicializar Octokit
let octokit = null;

function getOctokit() {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN no está configurada en las variables de entorno');
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

/**
 * Verifica si un archivo ya existe en GitHub
 * @param {string} tokenId - ID del token
 * @param {string} renderType - Tipo de render ('closeup', 'shadow', 'glow', 'bn', 'uv', 'blackout', 'banana', 'normal')
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExistsInGitHub(tokenId, renderType = 'normal') {
  try {
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
    
    try {
      const response = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH
      });
      
      // Si llegamos aquí, el archivo existe
      console.log(`[github-storage] ✅ Archivo existe en GitHub: ${filePath}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        // Archivo no existe
        console.log(`[github-storage] ❌ Archivo no existe en GitHub: ${filePath}`);
        return false;
      }
      // Otro error, relanzar
      throw error;
    }
  } catch (error) {
    console.error(`[github-storage] ❌ Error verificando archivo en GitHub:`, error.message);
    // En caso de error, asumimos que no existe para permitir el renderizado
    return false;
  }
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
    const content = imageBuffer.toString('base64');
    
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
    
    await octokit.repos.createOrUpdateFileContents(uploadParams);
    
    console.log(`[github-storage] ✅ Archivo subido exitosamente a GitHub: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[github-storage] ❌ Error subiendo archivo a GitHub:`, error.message);
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

