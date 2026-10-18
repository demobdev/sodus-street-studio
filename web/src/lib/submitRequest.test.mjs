import assert from 'node:assert/strict'
import test from 'node:test'
import { createStudioRequest } from './submitRequest.ts'

const payload = { name: 'Fixture Guest', email: 'guest@example.test', projectType: 'Podcast', message: 'Test fixture only.' }

test('inquiries stay same-origin and preserve retry identity until accepted', async t => {
  const calls = []
  let failing = true
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    if (failing) throw new Error('Fixture network failure')
    return Response.json({ ok: true })
  })
  const submit = createStudioRequest()
  assert.equal((await submit('contact', payload)).ok, false)
  failing = false
  assert.deepEqual(await submit('contact', payload), { ok: true })
  assert.equal(calls[0].url, '/api/igloo/inquiry')
  assert.equal(calls[0].body.requestId, calls[1].body.requestId)
  assert.equal(calls[1].body.type, 'contact')
  assert.equal('_replyto' in calls[1].body, false)
  assert.equal('to' in calls[1].body, false)
  await submit('contact', payload)
  assert.notEqual(calls[1].body.requestId, calls[2].body.requestId)
})

test('changed submissions and separate forms get independent identities', async t => {
  const ids = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    ids.push(JSON.parse(options.body).requestId)
    return Response.json({ ok: false }, { status: 503 })
  })
  const first = createStudioRequest()
  await first('contact', payload)
  await first('contact', { ...payload, message: 'Changed message' })
  await createStudioRequest()('contact', payload)
  assert.equal(new Set(ids).size, 3)
})

test('provider activation text and malformed acknowledgments cannot become success', async t => {
  for (const response of [
    () => Response.json({ success: true, message: 'This form needs Activation maat@onthemovecs.com' }),
    () => Response.json({ ok: false, error: 'PRIVATE PROVIDER ERROR' }, { status: 503 }),
    () => new Response('<html>Service unavailable</html>', { status: 503 }),
    () => Response.json({ ok: true, simulated: true }),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response())
    const result = await createStudioRequest()('contact', payload)
    assert.equal(result.ok, false)
    assert.doesNotMatch(result.error, /Activation|maat@|PRIVATE/)
    assert.match(result.error, /details are still here/)
  }
})

test('rate limiting gives a visitor-safe retry message', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Internal detail' }, { status: 429 }))
  const result = await createStudioRequest()('contact', payload)
  assert.equal(result.ok, false)
  assert.match(result.error, /wait a few minutes/)
})
