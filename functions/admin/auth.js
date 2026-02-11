export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Si GitHub nos devuelve el código, lo procesamos
  if (code) {
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
    
    // Devolvemos el token al CMS
    return new Response(
      `<html><body><script>
        const postMsg = (token) => {
          window.opener.postMessage('authorization:github:success:' + JSON.stringify({token}), '*');
          window.close();
        };
        postMsg('${result.access_token}');
      </script></body></html>`,
      { headers: { "content-type": "text/html" } }
    );
  }

  // Si no hay código, redirigimos a GitHub para pedir permiso
  const url = `https://github.com/login/oauth/authorize?client_id=${context.env.GITHUB_CLIENT_ID}&scope=repo,user`;
  return Response.redirect(url);
}
