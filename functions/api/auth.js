export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const redirectUri = `${url.origin}${url.pathname}`;

  // Responder a peticiones OPTIONS para evitar bloqueos de navegador
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Cross-Origin-Opener-Policy": "unsafe-none"
      }
    });
  }

  // Redirección inicial a GitHub
  if (!code) {
    const gh = new URL("https://github.com/login/oauth/authorize");
    gh.searchParams.set("client_id", context.env.GITHUB_CLIENT_ID);
    gh.searchParams.set("scope", "repo,user");
    gh.searchParams.set("redirect_uri", redirectUri);
    return Response.redirect(gh.toString(), 302);
  }

  // Intercambio de código por token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify({
      client_id: context.env.GITHUB_CLIENT_ID,
      client_secret: context.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const result = await tokenRes.json();

  if (!result.access_token) {
    return new Response(`Error: ${JSON.stringify(result)}`, { status: 401 });
  }

  const token = result.access_token;

  // SCRIPT TRIPLE ACCIÓN: postMessage + localStorage + reload
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Autorizando Prince Admin...</title></head>
<body>
<script>
(function () {
  var provider = "github";
  var token = "${token}";
  var msg = "authorization:" + provider + ":success:" + JSON.stringify({ token: token });

  if (!window.opener) {
    document.body.innerText = "Error: window.opener nulo. Bloqueo de seguridad COOP detectado.";
    return;
  }

  // 1) Intentar mensaje normal
  try { window.opener.postMessage(msg, "*"); } catch (e) {}

  // 2) FALLBACK: Guardar token directamente en el Admin
  try {
    var user = JSON.stringify({ token: token, provider: provider });
    window.opener.localStorage.setItem("decap-cms-user", user);
    window.opener.localStorage.setItem("netlify-cms-user", user);
  } catch (e) {}

  // 3) FORZAR RECARGA del Admin para que reconozca la sesión
  try {
    window.opener.location.reload();
  } catch (e) {
    window.opener.location.href = "${url.origin}/admin/#/";
  }

  setTimeout(function () { window.close(); }, 400);
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cache-Control": "no-store",
    },
  });
}
