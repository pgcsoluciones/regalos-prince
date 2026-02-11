// Función para inyectar cabeceras de seguridad en todas las respuestas
function withHeaders(resp) {
  const headers = new Headers(resp.headers);
  // ✅ Crucial: Permite que la ventana hija hable con la madre (el Admin)
  headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "no-store");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

export async function onRequest(context) {
  const urlObj = new URL(context.request.url);

  // Manejo de peticiones de seguridad del navegador
  if (context.request.method === "OPTIONS") {
    return withHeaders(new Response(null, { status: 204 }));
  }

  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const redirectUri = `${urlObj.origin}${urlObj.pathname}`;

  // 1. Fase de Redirección a GitHub
  if (!code) {
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", context.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set("scope", "repo,user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    if (state) authUrl.searchParams.set("state", state);

    return withHeaders(Response.redirect(authUrl.toString(), 302));
  }

  // 2. Fase de Intercambio de Token
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        client_id: context.env.GITHUB_CLIENT_ID,
        client_secret: context.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const result = await response.json();

    if (!result.access_token) {
      return withHeaders(
        new Response(`Error de OAuth: ${JSON.stringify(result)}`, { status: 401 })
      );
    }

    // 3. Script de Comunicación (PostMessage)
    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Autorizando Prince Admin...</title></head>
  <body>
    <script>
      (function () {
        var token = ${JSON.stringify(result.access_token)};
        var msg = "authorization:github:success:" + JSON.stringify({ token: token });

        if (window.opener) {
          window.opener.postMessage(msg, "*");
          setTimeout(function(){ window.close(); }, 300);
        } else {
          // Si ves este mensaje, es que el navegador bloqueó la conexión
          document.body.innerText = "Error: window.opener no detectado. Política COOP activa.";
        }
      })();
    </script>
  </body>
</html>`;

    return withHeaders(new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));

  } catch (e) {
    return withHeaders(new Response("Error técnico: " + e.message, { status: 500 }));
  }
}
