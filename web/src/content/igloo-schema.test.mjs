import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  iglooPageHtml, iglooPageUrl, iglooStructuredData, publicSiteOrigin, serializeStructuredData,
} from './igloo-schema.ts'

test('igloo graph connects the visible experience, page and correctly addressed business', () => {
  assert.equal(publicSiteOrigin, 'https://sodusstreetstudio.com')
  assert.equal(iglooPageUrl, 'https://sodusstreetstudio.com/igloos')
  const nodes = iglooStructuredData['@graph']
  const byId = new Map(nodes.map(node => [node['@id'], node]))
  const page = nodes.find(node => node['@type'] === 'WebPage')
  const service = nodes.find(node => node['@type'] === 'Service')
  const business = nodes.find(node => node['@type'] === 'LocalBusiness')
  assert.equal(page.url, iglooPageUrl)
  assert.equal(byId.get(page.mainEntity['@id']), service)
  assert.equal(byId.get(service.provider['@id']), business)
  assert.deepEqual(business.address, {
    '@type': 'PostalAddress', streetAddress: '28 Sodus Street', addressLocality: 'Clyde',
    addressRegion: 'NY', postalCode: '14433', addressCountry: 'US',
  })
  for (const image of service.image) assert.equal(new URL(image).origin, publicSiteOrigin)
})

test('closed-booking page makes no ticket, inventory, review or event-eligibility claims', () => {
  const schema = JSON.stringify(iglooStructuredData)
  assert.doesNotMatch(schema, /"(?:offers|availability|potentialAction|aggregateRating|review|eventStatus|startDate)"/)
  assert.doesNotMatch(schema, /"@type":"(?:Event|Product|FAQPage)"/)
})

test('inline JSON-LD cannot close its script element and round-trips accurately', () => {
  const payload = { name: '</script><script>alert("x")</script>&\u2028\u2029' }
  const serialized = serializeStructuredData(payload)
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/)
  assert.deepEqual(JSON.parse(serialized), payload)
})

test('initial igloo HTML contains one canonical and parseable graph while retaining the app entry', () => {
  const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const html = iglooPageHtml(source)
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1)
  assert.match(html, /<title>Igloo Evenings in Clyde, NY/)
  assert.ok(html.includes(`href="${iglooPageUrl}"`))
  const json = html.match(/<script id="igloo-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  assert.deepEqual(JSON.parse(json), iglooStructuredData)
  assert.match(html, /<div id="root"><\/div>/)
  assert.match(html, /src="\/src\/main.tsx"/)
})

test('exact igloo rewrites precede SPA fallback without capturing private booking routes', () => {
  for (const configPath of ['../../../vercel.json', '../../vercel.json']) {
    const config = JSON.parse(readFileSync(new URL(configPath, import.meta.url), 'utf8'))
    for (const source of ['/igloos', '/igloos/']) {
      assert.deepEqual(config.rewrites.find(rule => rule.source === source), { source, destination: '/igloos/index.html' })
      assert.ok(config.rewrites.findIndex(rule => rule.source === source) < config.rewrites.findIndex(rule => rule.source === '/(.*)'))
    }
    assert.equal(config.rewrites.some(rule => rule.source === '/igloos/:route*'), false)
  }
})
