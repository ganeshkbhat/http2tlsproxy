const tls = require('tls');

function createTlsServer(config, requestHandler) {
  const server = tls.createServer(
    {
      key: config.key,
      cert: config.cert,
      rejectUnauthorized: config.rejectUnauthorized !== undefined ? config.rejectUnauthorized : false
    },
    (socket) => {
      let buffer = Buffer.alloc(0);
      let expectedLength = null;

      socket.on('data', async (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (true) {
          if (expectedLength === null) {
            if (buffer.length < 4) {
              return; // Need more data for header
            }
            expectedLength = buffer.readUInt32BE(0);
            buffer = buffer.slice(4);
          }

          if (buffer.length < expectedLength) {
            return; // Waiting for full frame payload
          }

          const payloadBuffer = buffer.slice(0, expectedLength);
          buffer = buffer.slice(expectedLength);
          expectedLength = null;

          try {
            const reqPayload = JSON.parse(payloadBuffer.toString('utf8'));
            const responsePayload = await requestHandler(reqPayload);
            sendFrame(socket, responsePayload);
          } catch (err) {
            const errorPayload = {
              status: 500,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ error: err.message })
            };
            sendFrame(socket, errorPayload);
          }
        }
      });

      socket.on('error', (err) => {
        // Handle socket errors gracefully
      });
    }
  );

  server.listen(config.port || 8443, config.host || '127.0.0.1', () => {
    console.log(`[TLS Server] Native TLS Server listening on ${config.host || '127.0.0.1'}:${config.port || 8443}`);
  });

  return server;
}

function createTlsClient(config) {
  return {
    sendHttpRequestPayload: async (httpRequestDetails) => {
      return new Promise((resolve, reject) => {
        const socket = tls.connect(
          {
            host: config.host || '127.0.0.1',
            port: config.port || 8443,
            rejectUnauthorized: config.rejectUnauthorized !== undefined ? config.rejectUnauthorized : false
          },
          () => {
            sendFrame(socket, httpRequestDetails);
          }
        );

        let buffer = Buffer.alloc(0);
        let expectedLength = null;

        socket.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);

          if (expectedLength === null && buffer.length >= 4) {
            expectedLength = buffer.readUInt32BE(0);
            buffer = buffer.slice(4);
          }

          if (expectedLength !== null && buffer.length >= expectedLength) {
            const payloadBuffer = buffer.slice(0, expectedLength);
            socket.end();

            try {
              const parsedResponse = JSON.parse(payloadBuffer.toString('utf8'));
              resolve(parsedResponse);
            } catch (parseErr) {
              reject(new Error(`Failed to parse TLS response payload: ${parseErr.message}`));
            }
          }
        });

        socket.on('error', (err) => {
          reject(err);
        });
      });
    },
    close: () => {}
  };
}

function sendFrame(socket, obj) {
  const jsonString = JSON.stringify(obj);
  const payloadBuffer = Buffer.from(jsonString, 'utf8');
  const headerBuffer = Buffer.alloc(4);
  headerBuffer.writeUInt32BE(payloadBuffer.length, 0);
  socket.write(Buffer.concat([headerBuffer, payloadBuffer]));
}

module.exports = {
  createTlsServer,
  createTlsClient
};