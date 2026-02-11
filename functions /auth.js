export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const provider = searchParams.get("provider") || "github"; 

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

    // El mensaje de éxito debe incluir el provider dinámicamente
    return new Response(
      `<html><body><script>
        window.opener.postMessage(
          'authorization:${provider}:success:' + JSON.stringify({ token: '${result.access_token}' }),
          '*'
        );
        window.close();
      </script></body></html>`,
      { headers: { "content-type": "text/html" } }
    );
  }

  const url = `https://github.com/login/oauth/authorize?client_id=${context.env.GITHUB_CLIENT_ID}&scope=repo,user&state=${state}`;
  return Response.redirect(url, 302);
}
