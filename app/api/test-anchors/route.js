import path from 'path';

export async function GET(request) {
  try {
    const TextToSVGmod = await import('text-to-svg');
    const TextToSVG = TextToSVGmod.default || TextToSVGmod.TextToSVG;
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto', 'Roboto-VariableFont_wdth,wght.ttf');
    const instance = TextToSVG.loadSync(fontPath);
    
    // Probar diferentes anclajes
    const anchors = ['start', 'middle', 'end', 'left', 'right', 'top', 'bottom', 'center'];
    const testText = 'TEST';
    
    let results = '';
    
    for (const anchor of anchors) {
      try {
        const pathData = instance.getPath(testText, {
          fontSize: 24,
          anchor: anchor
        });
        results += `✅ "${anchor}": ${pathData.substring(0, 100)}...\n`;
      } catch (error) {
        results += `❌ "${anchor}": ${error.message}\n`;
      }
    }
    
    // Probar combinaciones
    const combinations = ['start middle', 'middle middle', 'end middle', 'center middle'];
    
    results += '\n--- COMBINACIONES ---\n';
    for (const combo of combinations) {
      try {
        const pathData = instance.getPath(testText, {
          fontSize: 24,
          anchor: combo
        });
        results += `✅ "${combo}": ${pathData.substring(0, 100)}...\n`;
      } catch (error) {
        results += `❌ "${combo}": ${error.message}\n`;
      }
    }
    
    return new Response(results, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('[test-anchors] Error:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 