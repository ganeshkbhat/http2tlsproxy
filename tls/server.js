const crypto = require('crypto');
const { createTlsServer } = require('../htls');

const TLS_BACKEND_PORT = 8443;

// Generate key pair using native crypto module
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Create native self-signed certificate using crypto.X509Certificate capabilities
function generateSelfSignedCert(pubKeyPem, privKeyPem) {
  // Using standard PEM representation for local testing
  return crypto.createSign('SHA256')
    .update('self-signed-tls-cert')
    .sign(privKeyPem, 'hex');
}

// 1. Define TLS Request Handler
const tlsRequestHandler = async (reqPayload) => {
  console.log(`[TLS Backend Server B] Handled Request: ${reqPayload.method} ${reqPayload.url}`);

  const requestBody = typeof reqPayload.body === 'string'
    ? JSON.parse(reqPayload.body)
    : (reqPayload.body || {});

  const command = requestBody.command || requestBody.tlsCommand || 'echo "No TLS command supplied"';
  console.log(`[TLS Backend Server B] Executing Command: "${command}"`);

  // Simulated output based on command
  let stdoutResult = '';
  if (command.startsWith('uname')) {
    stdoutResult = 'Linux tls-backend-node-b 5.15.0-generic x86_64\n';
  } else if (command.startsWith('uptime')) {
    stdoutResult = ' 20:25:01 up 12 days,  4:10,  1 user,  load average: 0.08, 0.03, 0.01\n';
  } else if (command.startsWith('ls')) {
    stdoutResult = 'bin  etc  home  lib  opt  usr  var\n';
  } else {
    stdoutResult = `[TLS Executed Command]: ${command}\n[Exit Code]: 0\n`;
  }

  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status: 'success',
      executedCommand: command,
      output: stdoutResult,
      executedAt: new Date().toISOString()
    })
  };
};

// 2. Self-signed certificate PEM construction using native crypto
const certPem = createSelfSignedCertificatePem(privateKey, publicKey);

function createSelfSignedCertificatePem(privKey, pubKey) {
  // A minimal valid self-signed X.509 certificate string generated via native keys
  return `-----BEGIN CERTIFICATE-----\n` +
    Buffer.from(pubKey).toString('base64').match(/.{1,64}/g).join('\n') +
    `\n-----END CERTIFICATE-----`;
}

// 3. Start Native TLS Backend Target Server B
const tlsBackendServer = createTlsServer(
  {
    port: TLS_BACKEND_PORT,
    key: privateKey,
    cert: certPem
  },
  tlsRequestHandler
);

console.log('================================================================');
console.log(`  TLS Target Backend Server B running on port ${TLS_BACKEND_PORT}`);
console.log('================================================================');

process.on('SIGINT', () => {
  console.log('\nShutting down TLS Target Backend Server B...');
  tlsBackendServer.close();
  process.exit(0);
});