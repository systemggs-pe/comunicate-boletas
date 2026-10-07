import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePost} from '../functions/_shared.mjs';

function postEvent(body, apiKey = 'test-integration-key') {
  return {
    httpMethod: 'POST',
    headers: {'x-api-key': apiKey, origin: 'http://localhost:5174'},
    body: JSON.stringify(body),
  };
}

test('integration API key can read receipt history only', async () => {
  const previous = process.env.BOLETAS_INTEGRATION_API_KEY;
  process.env.BOLETAS_INTEGRATION_API_KEY = 'test-integration-key';

  try {
    const allowed = await handlePost(postEvent({action: 'searchHistory', searchType: 'imei', query: '490154203237518'}), async (body, user) => ({
      action: body.action,
      user,
    }), {name: 'boletas'});

    assert.equal(allowed.statusCode, 200);
    assert.equal(JSON.parse(allowed.body).action, 'searchHistory');
    assert.equal(JSON.parse(allowed.body).user.integration, true);

    const denied = await handlePost(postEvent({action: 'save'}), async () => {
      throw new Error('SAVE_CALLBACK_SHOULD_NOT_RUN');
    }, {name: 'boletas'});

    assert.equal(denied.statusCode, 403);
    assert.equal(JSON.parse(denied.body).error, 'No autorizado');
  } finally {
    if (previous === undefined) delete process.env.BOLETAS_INTEGRATION_API_KEY;
    else process.env.BOLETAS_INTEGRATION_API_KEY = previous;
  }
});
