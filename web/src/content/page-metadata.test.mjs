import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { faqCategories } from './faq.ts'
import { services } from './services.ts'
import { metadataForPath, pageMetadataHtml, privatePages, publicPages } from './page-metadata.ts'
import { publicSiteOrigin } from './site-schema.ts'

const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

test('every routed public and private page is covered without query or fragment canonicals', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  const routes = ['/', ...[...app.matchAll(/<Route path="([^"*]+)"/g)].map(match => `/${match[1]}`)]
  assert.deepEqual([...publicPages, ...privatePages].map(page => page.path).sort(), routes.sort())
  assert.equal(new Set(publicPages.map(page => page.title)).size, publicPages.length)
  for (const page of publicPages) {
    assert.equal(page.canonical, `${publicSiteOrigin}${page.path}`)
    assert.equal(metadataForPath(`${page.path}/?campaign=test#rates`), page)
  }
})

test('public initial HTML has one matching canonical and a fully connected domain-correct graph', () => {
  for (const page of publicPages) {
    const html = pageMetadataHtml(source, page)
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1, page.path)
    assert.ok(html.includes(`href="${page.canonical}"`), page.path)
    assert.doesNotMatch(html, /noindex|vercel\.app/, page.path)
    assert.match(html, /<div id="root"><\/div>/)
    const schema = JSON.parse(html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
    const nodes = schema['@graph']
    const ids = new Set(nodes.map(node => node['@id']))
    assert.equal(ids.size, nodes.length, page.path)
    function check(value) {
      if (!value || typeof value !== 'object') return
      if (Object.keys(value).length === 1 && value['@id']) assert.ok(ids.has(value['@id']), value['@id'])
      for (const [key, child] of Object.entries(value)) {
        if (typeof child === 'string' && /^https?:/.test(child) && key !== '@context') {
          assert.equal(new URL(child).origin, publicSiteOrigin, `${page.path}: ${child}`)
        }
        check(child)
      }
    }
    check(schema)
    assert.equal(nodes[0].url, page.canonical)
    assert.equal(nodes[0].name, page.title)
    assert.equal(nodes[0].description, page.description)
    assert.doesNotMatch(JSON.stringify(schema), /"(?:offers|availability|potentialAction|aggregateRating|openingHours|telephone|email)"/)
  }
})

test('FAQ and services reuse visible content and portfolio does not invent samples', () => {
  const faq = metadataForPath('/faq').structuredData['@graph'][0]
  assert.equal(faq['@type'], 'FAQPage')
  assert.deepEqual(faq.mainEntity.map(question => ({ question: question.name, answer: question.acceptedAnswer.text })),
    faqCategories.flatMap(category => category.items))
  const serviceNodes = metadataForPath('/services').structuredData['@graph'].filter(node => node['@type'] === 'Service')
  assert.deepEqual(serviceNodes.map(node => [node.name, node.description]), services.map(service => [service.title, service.description]))
  const portfolio = JSON.stringify(metadataForPath('/portfolio').structuredData)
  assert.doesNotMatch(portfolio, /CreativeWork|AudioObject|MusicRecording|ItemList/)
})

test('private tools clear public metadata and stay noindex in initial HTML and response headers', () => {
  const homepage = pageMetadataHtml(source, metadataForPath('/'))
  const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'))
  for (const page of privatePages) {
    const html = pageMetadataHtml(homepage, page)
    assert.match(html, /name="robots" content="noindex, nofollow"/)
    assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json/)
    assert.match(html, /<div id="root"><\/div>/)
    assert.ok(config.headers.find(rule => rule.source === page.path)?.headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex, nofollow'))
  }
  assert.equal(metadataForPath('/not-a-real-page').noindex, true)
})

test('both deployment configurations serve each exact route before the SPA fallback', () => {
  for (const configPath of ['../../../vercel.json', '../../vercel.json']) {
    const config = JSON.parse(readFileSync(new URL(configPath, import.meta.url), 'utf8'))
    for (const page of [...publicPages, ...privatePages].filter(page => page.path !== '/')) {
      for (const path of [page.path, `${page.path}/`]) {
        const index = config.rewrites.findIndex(rule => rule.source === path)
        assert.ok(index >= 0 && index < config.rewrites.findIndex(rule => rule.source === '/(.*)'), path)
        assert.equal(config.rewrites[index].destination, `${page.path}/index.html`)
      }
    }
  }
})

test('replacing initial page metadata is idempotent and preserves the app shell', () => {
  const metadata = metadataForPath('/about')
  const twice = pageMetadataHtml(pageMetadataHtml(source, metadata), metadata)
  assert.equal((twice.match(/rel="canonical"/g) ?? []).length, 1)
  assert.equal((twice.match(/application\/ld\+json/g) ?? []).length, 1)
  assert.match(twice, /<div id="root"><\/div>/)
  assert.match(twice, /src="\/src\/main.tsx"/)
})
