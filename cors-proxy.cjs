// Run: node cors-proxy.cjs
// Forwards all requests to the Claude proxy on port 3456 with CORS headers.

const http  = require('http')

const TARGET_HOST = '127.0.0.1'
const TARGET_PORT = 3456
const PROXY_PORT  = 8010

const ALLOWED_ORIGINS = [
  'https://aarchstudio.netlify.app',
  'http://localhost:5173',
]

http.createServer((req, res) => {
  const origin = req.headers['origin'] || ''

  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, bypass-tunnel-reminder')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const proxy = http.request(
    { hostname: TARGET_HOST, port: TARGET_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` } },
    (proxyRes) => {
      const headers = { ...proxyRes.headers }
      headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
      res.writeHead(proxyRes.statusCode, headers)
      proxyRes.pipe(res)
    }
  )

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message)
    res.writeHead(502)
    res.end('Bad Gateway')
  })

  req.pipe(proxy)

}).listen(PROXY_PORT, () => {
  console.log(`CORS proxy :${PROXY_PORT} → http://${TARGET_HOST}:${TARGET_PORT}`)
})
