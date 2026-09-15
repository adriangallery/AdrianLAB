// Cola de escrituras sin dependencias (se prueba con node --test sin instalar Octokit).
// Escrituras en GitHub de una en una por proceso. Varios commits simultáneos a la misma rama chocan
// (409 «is at X but expected Y») y GitHub solo acepta uno: con renders en paralelo se perdían entradas
// de la caché por hash (15-sep-2026, mini: se subieron 4 de 12 renders lanzados de 3 en 3).
let writeChain = Promise.resolve();
const WRITE_CONFLICT_RETRIES = 3;

export function serializedWrite(write, { retries = WRITE_CONFLICT_RETRIES, delayMs = 500 } = {}) {
  const run = writeChain.then(async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await write();
      } catch (error) {
        if (error?.status !== 409 || attempt >= retries) throw error;
        console.warn(`[github-storage] ⚠️ Conflicto 409 al escribir (intento ${attempt}/${retries}), reintento`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  });
  // La cola sigue aunque una escritura falle; el error lo recibe quien la pidió
  writeChain = run.catch(() => {});
  return run;
}
