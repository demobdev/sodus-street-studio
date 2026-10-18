import { iglooEvent } from './igloo-event.ts'
import { site } from './site.ts'

// Keep the working production address until the custom domain serves this site.
// Change this once, together with the domain cutover, then rebuild.
export const publicSiteOrigin = 'https://sodus-street-studio.vercel.app'
export const iglooPageUrl = `${publicSiteOrigin}/igloos`
export const iglooPageTitle = `Igloo Evenings in Clyde, NY | ${site.name}`
export const iglooPageDescription = `Private igloo evenings at ${site.name} in Clyde, NY. ${iglooEvent.durationMinutes} minutes, up to ${iglooEvent.maxGuests} guests and one platter. Explore the October 2026 dates and details.`
export const studioPageTitle = 'Sodus Street Studio | Recording Studio in Clyde, NY'
export const studioPageDescription = 'Sodus Street Studio — a welcoming multimedia studio in Clyde, NY for podcast recording, voiceover, music, and creative production.'

const businessId = `${publicSiteOrigin}/#business`
const serviceId = `${iglooPageUrl}#experience`
const images = ['/images/igloos-evening.jpg', '/images/igloo-entrance.jpg']
  .map(path => `${publicSiteOrigin}${path}`)

// This page describes multiple evenings, rather than a single event leaf page.
// Do not publish ticket offers or availability independently of live inventory.
export const iglooStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${iglooPageUrl}#webpage`,
      url: iglooPageUrl,
      name: iglooPageTitle,
      description: iglooPageDescription,
      inLanguage: 'en-US',
      mainEntity: { '@id': serviceId },
      publisher: { '@id': businessId },
      primaryImageOfPage: { '@type': 'ImageObject', url: images[0] },
    },
    {
      '@type': 'Service',
      '@id': serviceId,
      name: iglooEvent.title,
      serviceType: 'Private igloo dining experience',
      description: `${iglooEvent.durationMinutes} minutes in a private igloo for up to ${iglooEvent.maxGuests} guests, with one of four platters included.`,
      url: iglooPageUrl,
      image: images,
      provider: { '@id': businessId },
      mainEntityOfPage: { '@id': `${iglooPageUrl}#webpage` },
    },
    {
      '@type': 'LocalBusiness',
      '@id': businessId,
      name: site.name,
      url: publicSiteOrigin,
      image: images,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.line1,
        addressLocality: 'Clyde',
        addressRegion: 'NY',
        postalCode: '14433',
        addressCountry: 'US',
      },
    },
  ],
} as const

export function serializeStructuredData(value: unknown) {
  // A JSON string can contain </script>; escape HTML-significant characters
  // without changing the data after JSON.parse.
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

export const iglooJsonLd = serializeStructuredData(iglooStructuredData)

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function iglooPageHtml(html: string) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttribute(iglooPageTitle)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeAttribute(iglooPageDescription)}" />`)
    .replace('</head>', `    <link id="igloo-canonical" rel="canonical" href="${iglooPageUrl}" />\n    <script id="igloo-structured-data" type="application/ld+json">${iglooJsonLd}</script>\n  </head>`)
}
