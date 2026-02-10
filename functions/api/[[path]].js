export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Cabeceras de seguridad y acceso (CORS)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Manejar peticiones previas de seguridad (Preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // RUTA: Obtener catálogo completo
    if (path === "/api/productos" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM productos WHERE is_active = 1").all();
      return new Response(JSON.stringify(results), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // RUTA: Subir imágenes al almacén R2
    if (path === "/api/media/upload" && request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get('file');
      const fileName = `san-valentin/${Date.now()}-${file.name}`;
      
      await env.R2.put(fileName, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
      
      return new Response(JSON.stringify({ url: fileName }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response("Ruta Prince no encontrada", { status: 404 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}
