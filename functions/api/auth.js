export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get("code");

  if (!code) {
    const url = `https://github.com/login/oauth/authorize?client_id=${context.env.GITHUB_CLIENT_ID}&scope=repo,user`;
    return Response.redirect(url, 302);
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
      }),
    });

    const result = await response.json();

    // SCRIPT DE CONEXIÓN DEFINITIVO
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Autorizando Prince Admin...</title></head>
      <body>
        <script>
          (function() {
            const token = "${result.access_token}";
            const provider = "github";
            
            // Formato exacto que requiere el CMS para desbloquear el panel
            const response = {
              token: token,
              provider: provider
            };

            // Intentamos enviar el mensaje a la ventana que abrió esta
            if (window.opener) {
              window.opener.postMessage(
                "authorization:" + provider + ":success:" + JSON.stringify(response),
                window.location.origin
              );
              
              // Pequeña pausa para asegurar el envío antes de cerrar
              setTimeout(() => {
                window.close();
              }, 500);
            } else {
              document.body.innerHTML = "Error: No se encontró la ventana principal. Por favor, intenta de nuevo.";
            }
          })();
        </script>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "content-type": "text/html" } });

  } catch (e) {
    return new Response("Error técnico: " + e.message, { status: 500 });
  }
}
