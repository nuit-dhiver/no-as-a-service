const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp } = require('../index');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function withServer(app, run) {
  const serverInfo = await listen(app);

  try {
    await run(serverInfo.baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      serverInfo.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /no returns a random rejection reason', async () => {
  await withServer(createApp({ aiProvider: null }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.reason, 'string');
    assert.ok(body.reason.length > 0);
    assert.deepEqual(Object.keys(body), ['reason']);
  });
});

test('POST /no/ai rejects missing messages', async () => {
  await withServer(createApp({ aiProvider: null }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tone: 'funny' })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'message is required');
  });
});

test('POST /no/ai rejects empty messages', async () => {
  await withServer(createApp({ aiProvider: null }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'message is required');
  });
});

test('POST /no/ai falls back to random when no provider is configured', async () => {
  await withServer(createApp({ aiProvider: null }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Can you join another meeting today?' })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.reason, 'string');
    assert.equal(body.ai, false);
    assert.equal(body.fallback, 'random');
  });
});

test('POST /no/ai defaults invalid tone to funny for provider calls', async () => {
  const aiProvider = {
    async generateRejection({ tone }) {
      return `tone:${tone}`;
    }
  };

  await withServer(createApp({ aiProvider }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'Can you cover my shift?',
        tone: 'feral'
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      reason: 'tone:funny',
      ai: true,
      tone: 'funny'
    });
  });
});

test('POST /no/ai returns contextual provider responses', async () => {
  const aiProvider = {
    async generateRejection({ message, tone }) {
      assert.equal(message, 'Can you work this weekend?');
      assert.equal(tone, 'professional');
      return 'I appreciate the request, but I cannot commit to weekend work right now.';
    }
  };

  await withServer(createApp({ aiProvider }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'Can you work this weekend?',
        tone: 'professional'
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      reason: 'I appreciate the request, but I cannot commit to weekend work right now.',
      ai: true,
      tone: 'professional'
    });
  });
});

test('POST /no/ai falls back to random when provider fails', async () => {
  const aiProvider = {
    async generateRejection() {
      throw new Error('provider down');
    }
  };

  await withServer(createApp({ aiProvider }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Please write my report tonight.' })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.reason, 'string');
    assert.equal(body.ai, false);
    assert.equal(body.fallback, 'random');
  });
});
