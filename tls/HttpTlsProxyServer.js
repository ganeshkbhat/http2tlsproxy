const { createTlsClient } = require('../htls');
const { createHttpServer, sendHttpRequest } = require('../../httpm');

const TLS_BACKEND_PORT = 8443;
const HTTP_PROXY_PORT = 9018;

async function startReverseProxyGateway() {
  console.log('================================================================');
  console.log('  HTTP Reverse Proxy Gateway Server (Forwarding to TLS Server B)');
  console.log('================================================================\n');

  // 1. Initialize native TLS Client pointing to TLS Server B
  const tlsProxyClient = createTlsClient({
    port: TLS_BACKEND_PORT,
    host: '127.0.0.1',
    rejectUnauthorized: false
  });

  // 2. Forward incoming HTTP request details over the TLS connection
  const tlsProxyHandler = async (httpRequestDetails) => {
    console.log(`[HTTP Server B Proxy] Forwarding ${httpRequestDetails.method} ${httpRequestDetails.url} -> TLS Server B:${TLS_BACKEND_PORT}`);

    const tlsResponse = await tlsProxyClient.sendHttpRequestPayload(httpRequestDetails);

    return {
      protocolClient: tlsProxyClient,
      response: tlsResponse
    };
  };

  // 3. Start HTTP Reverse Proxy Gateway Server B
  const httpServer = createHttpServer(
    { httpPort: HTTP_PROXY_PORT },
    tlsProxyHandler
  );

  console.log(`[HTTP Server B Proxy] Active and listening on http://127.0.0.1:${HTTP_PROXY_PORT}`);

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 4. Test execution representing HTTP Client A
  console.log('\n--- Initiating Request from HTTP Client A to HTTP Server B Proxy ---');
  try {
    const response = await sendHttpRequest({
      targetUrl: `http://127.0.0.1:${HTTP_PROXY_PORT}/api/v1/tls/exec`,
      method: 'POST',
      body: {
        command: 'uname -a'
      }
    });

    console.log('\n[HTTP Client A] Received Response Status:', response.statusCode);
    console.log('[HTTP Client A] Received Response Body:\n', JSON.stringify(response.body, null, 2));
  } catch (err) {
    console.error('[HTTP Client A] Reverse Proxy Request Failed:', err.message);
  }

  process.on('SIGINT', () => {
    console.log('\nShutting down HTTP Reverse Proxy Gateway Server B...');
    httpServer.server.close();
    process.exit(0);
  });
}

startReverseProxyGateway();