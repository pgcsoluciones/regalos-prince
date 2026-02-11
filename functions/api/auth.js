export async function onRequestGet(context) {
  const urlObj = new URL(context.request.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");

  // URL exacta para evitar el error de mismatch en el redirect_uri
  const redirectUri = `${urlObj.origin}${urlObj.pathname}`;

  if (!code) {
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", context.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set("scope", "repo,user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    if (state) authUrl.searchParams.set("state", state);

    return Response.redirect(authUrl.toString(), 302);
  }

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

    // Si no hay token, mostramos el error técnico en lugar de intentar cerrar la ventana
    if (!result.access_token) {
      return new Response(
        `Error de OAuth: ${JSON.stringify(result)}`,
        { status: 401, headers: { "content-type": "text/plain" } }
      );
    }

    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Autorizando Prince Admin...</title></head>
  <body>
    <script>
      (function () {
        var token = ${JSON.stringify(result.access_token)};
        // Formato estricto para Decap CMS
        var msg = "authorization:github:success:" + JSON.stringify({ token: token });

        if (window.opener) {
          // El targetOrigin en "*" soluciona el problema de que el panel no reaccione
          window.opener.postMessage(msg, "*");
          setTimeout(function(){ window.close(); }, 300);
        } else {
          document.body.innerText = "Error: No se encontró la ventana principal del administrador.";
        }
      })();
    </script>
  </body>
</html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });

  } catch (e) {
    return new Response("Error técnico de conexión: " + e.message, { status: 500 });
  }
}
