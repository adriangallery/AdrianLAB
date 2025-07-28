import { Resvg } from '@resvg/resvg-js';

export async function GET(request) {
  try {
    console.log(`[test-simple] 🧪 Endpoint test-simple accedido`);
    
    // Respuesta simple para verificar que funciona
    return new Response(JSON.stringify({ 
      message: 'Test simple endpoint funcionando',
      timestamp: new Date().toISOString(),
      status: 'OK'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('[test-simple] Error:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 