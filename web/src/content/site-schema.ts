import { site } from './site.ts'

export const publicSiteOrigin = 'https://sodusstreetstudio.com'
export const businessId = `${publicSiteOrigin}/#business`
export const websiteId = `${publicSiteOrigin}/#website`
export const studioPageTitle = 'Sodus Street Studio | Recording Studio in Clyde, NY'
export const studioPageDescription = 'Sodus Street Studio — a welcoming multimedia studio in Clyde, NY for podcast recording, voiceover, music, and creative production.'

// Only publish confirmed business details. The studio gallery is still mock
// photography, and phone, email and opening hours have not been confirmed.
export const businessStructuredData = {
  '@type': 'LocalBusiness',
  '@id': businessId,
  name: site.name,
  url: `${publicSiteOrigin}/`,
  logo: `${publicSiteOrigin}/logo.png`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: site.address.line1,
    addressLocality: 'Clyde',
    addressRegion: 'NY',
    postalCode: '14433',
    addressCountry: 'US',
  },
} as const

export const websiteStructuredData = {
  '@type': 'WebSite',
  '@id': websiteId,
  url: `${publicSiteOrigin}/`,
  name: site.name,
  inLanguage: 'en-US',
  publisher: { '@id': businessId },
} as const

export function serializeStructuredData(value: unknown) {
  // A JSON string can contain </script>; escape HTML-significant characters
  // without changing the data after JSON.parse.
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}
