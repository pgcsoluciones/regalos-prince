export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get("code");

  // 1. Redirigir a GitHub si no hay código
  if (!code) {
    const url = `https://github.com/login/oauth/authorize?client_id=${context.env.GITHUB_CLIENT_ID}&scope=repo,user`;
    return Response.redirect(url, 302);
  }

  // 2. Intercambiar código por Token
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
      }),
    });

    const result = await response.json();

    // 3. RESPUESTA CRÍTICA: Este script cierra la ventana y activa el CMS
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          (function() {
            const token = "${result.access_token}";
            const message = "authorization:github:success:" + JSON.stringify({
              token: token,
              provider: "github"
            });
            
            // Envía el token a la ventana principal
            window.opener.postMessage(message, window.location.origin);
            
            // Cierra esta ventana después de enviar el mensaje
            setTimeout(() => window.close(), 200);
          })();
        </script>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "content-type": "text/html" } });

  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 });
  }
}
