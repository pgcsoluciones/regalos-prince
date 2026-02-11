// Auxiliar para inyectar cabeceras de compatibilidad extrema
function withSecurityHeaders(resp) {
  const headers = new Headers(resp.headers);
  headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  headers.set("Cross-Origin-Embedder-Policy", "unsafe-none"); // Nuevo: reduce fricción en Pages
  headers.set("Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

export async function onRequest(context) {
  const urlObj = new URL(context.request.url);
  const code = urlObj.searchParams.get("code");
  const redirectUri = `${urlObj.origin}${urlObj.pathname}`;

  if (context.request.method === "OPTIONS") {
    return withSecurityHeaders(new Response(null, { status: 204 }));
  }

  // 1. Redirección a GitHub
  if (!code) {
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", context.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set("scope", "repo,user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    return withSecurityHeaders(Response.redirect(authUrl.toString(), 302));
  }

  // 2. Intercambio de Token
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
    if (!result.access_token) return withSecurityHeaders(new Response("Error OAuth", { status: 401 }));

    const token = result.access_token;

    // 3. HTML de Respuesta con Múltiples Fallbacks (Harden Callback)
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Finalizando Autenticación...</title></head>
<body>
  <div id="status">Conectando con Prince Admin...</div>
  <script>
    (function() {
      const token = ${JSON.stringify(token)};
      const provider = "github";
      const userData = JSON.stringify({ token: token, provider: provider });
      const msg = "authorization:" + provider + ":success:" + JSON.stringify({ token: token });

      // Fallback 1: BroadcastChannel (Para navegadores modernos sin opener)
      try {
        const channel = new BroadcastChannel("decap-cms-auth");
        channel.postMessage({ token: token, provider: provider });
      } catch(e) {}

      // Fallback 2: LocalStorage local (por si acaso)
      localStorage.setItem("decap-cms-user", userData);

      if (window.opener) {
        // Fallback 3: postMessage estándar
        try { window.opener.postMessage(msg, "*"); } catch(e) {}
        
        // Fallback 4: Inyección en LocalStorage del opener + Reload
        try {
          window.opener.localStorage.setItem("decap-cms-user", userData);
          window.opener.localStorage.setItem("netlify-cms-user", userData);
          window.opener.location.reload();
        } catch(e) {}
        
        setTimeout(() => window.close(), 500);
      } else {
        // Fallback 5: Mensaje manual si todo falla
        document.getElementById("status").innerHTML = 
          'Sesión iniciada. <a href="/admin/">Haz clic aquí para volver al panel</a>';
      }
    })();
  </script>
</body>
</html>`;

    return withSecurityHeaders(new Response(html, { headers: { "content-type": "text/html" } }));

  } catch (e) {
    return withSecurityHeaders(new Response("Error: " + e.message, { status: 500 }));
  }
}
