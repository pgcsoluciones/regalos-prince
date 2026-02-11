export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");

  // 1. Si no hay código, redirigimos a GitHub para iniciar sesión
  if (!code) {
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${context.env.GITHUB_CLIENT_ID}&scope=repo,user`;
    return Response.redirect(githubUrl);
  }

  // 2. Si hay código, intercambiamos por un Token de acceso
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

    if (result.error) {
      return new Response(`Error de GitHub: ${result.error_description}`, { status: 500 });
    }

    // 3. Enviamos el token de vuelta al CMS mediante postMessage
    return new Response(
      `<html><body><script>
        (function() {
          const token = '${result.access_token}';
          const message = 'authorization:github:success:' + JSON.stringify({token: token, provider: 'github'});
          window.opener.postMessage(message, '*');
          window.close();
        })();
      </script></body></html>`,
      { headers: { "content-type": "text/html" } }
    );
  } catch (e) {
    return new Response(`Error interno: ${e.message}`, { status: 500 });
  }
}
