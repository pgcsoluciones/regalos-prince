export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get("code");

  // 1. Si no hay código, redirigimos a GitHub
  if (!code) {
    const url = `https://github.com/login/oauth/authorize?client_id=${context.env.GITHUB_CLIENT_ID}&scope=repo,user`;
    return Response.redirect(url, 302);
  }

  // 2. Intercambio de código por Token
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

    // 3. Respuesta especial que el CMS espera para cerrar la ventana y entrar
    const script = `
      <html><body><script>
        (function() {
          function recieveMessage(e) {
            console.log("Recibido:", e.data);
          }
          window.addEventListener("message", recieveMessage, false);
          
          const message = "authorization:github:success:" + JSON.stringify({
            token: "${result.access_token}",
            provider: "github"
          });
          
          window.opener.postMessage(message, "*");
          window.close();
        })();
      </script></body></html>
    `;

    return new Response(script, { headers: { "content-type": "text/html" } });

  } catch (e) {
    return new Response("Error de conexión: " + e.message, { status: 500 });
  }
}
