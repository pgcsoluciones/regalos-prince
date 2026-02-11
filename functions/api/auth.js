// Auxiliar para inyectar cabeceras de compatibilidad extrema y evitar "ventanas mudas"
function withSecurityHeaders(resp) {
  const headers = new Headers(resp.headers);
  // ✅ Permite que la ventana de login se comunique con el Admin sin bloqueos de Cloudflare
  headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  headers.set("Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

export async function onRequest(context) {
  const urlObj = new URL(context.request.url);
  const code = urlObj.searchParams.get("code");
  
  // ✅ Definimos la URI de redirección sin el .js para que coincida con GitHub
  const redirectUri = `${urlObj.origin}${urlObj.pathname}`;

  // Manejo de peticiones de seguridad del navegador
  if (context.request.method === "OPTIONS") {
    return withSecurityHeaders(new Response(null, { status: 204 }));
  }

  // 1. Fase de Redirección a GitHub (Si no hay código todavía)
  if (!code) {
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", context.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set("scope", "repo,user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    return withSecurityHeaders(Response.redirect(authUrl.toString(), 302));
  }

  // 2. Fase de Intercambio de Token (Cuando GitHub nos devuelve el código)
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        client_id: context.env.GITHUB_CLIENT_ID,
        client_secret: context.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const result = await response.json();

    // Si GitHub no nos da el token, devolvemos el error detallado
    if (!result.access_token) {
      return withSecurityHeaders(new Response(`Error de OAuth: ${JSON.stringify(result)}`, { status: 401 }));
    }

    const token = result.access_token;
    const provider = "github";

    // 3. HTML de Respuesta con "Defensa en Profundidad" para abrir el panel
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Autorizando Prince Admin...</title></head>
<body>
  <div id="status" style="font-family: sans-serif; text-align: center; margin-top: 50px;">
    Conectando con el panel de control...
  </div>
  <script>
    (function() {
      const token = ${JSON.stringify(token)};
      const provider = "${provider}";
      const userData = JSON.stringify({ token: token, provider: provider });
      const msg = "authorization:" + provider + ":success:" + JSON.stringify({ token: token });

      // FALLBACK 1: BroadcastChannel (Para navegadores modernos)
      try {
        const channel = new BroadcastChannel("decap-cms-auth");
        channel.postMessage({ token: token, provider: provider });
      } catch(e) {}

      // FALLBACK 2: LocalStorage local
      localStorage.setItem("decap-cms-user", userData);

      if (window.opener) {
        // FALLBACK 3: postMessage estándar (Lo que el CMS espera)
        try { window.opener.postMessage(msg, "*"); } catch(e) {}
        
        // FALLBACK 4: Inyección directa en el Admin + Recarga forzada
        try {
          window.opener.localStorage.setItem("decap-cms-user", userData);
          window.opener.localStorage.setItem("netlify-cms-user", userData);
          window.opener.location.reload();
        } catch(e) {}
        
        // Cerramos la ventana después de asegurar la entrega
        setTimeout(() => window.close(), 500);
      } else {
        // FALLBACK 5: Enlace manual si el navegador bloqueó todo lo anterior
        document.getElementById("status").innerHTML = 
          'Sesión autorizada. <a href="/admin/" style="color: #2ecc71; font-weight: bold;">Haga clic aquí para entrar al panel</a>';
      }
    })();
  </script>
</body>
</html>`;

    return withSecurityHeaders(new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));

  } catch (e) {
    return withSecurityHeaders(new Response("Error técnico: " + e.message, { status: 500 }));
  }
}
