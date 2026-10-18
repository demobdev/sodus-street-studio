import { iglooEvent } from './igloo-event.ts'
import { site } from './site.ts'
import { businessId, businessStructuredData, publicSiteOrigin } from './site-schema.ts'

export { publicSiteOrigin, serializeStructuredData } from './site-schema.ts'
export const iglooPageUrl = `${publicSiteOrigin}/igloos`
export const iglooPageTitle = `Igloo Evenings in Clyde, NY | ${site.name}`
export const iglooPageDescription = `Private igloo evenings at ${site.name} in Clyde, NY. ${iglooEvent.durationMinutes} minutes, up to ${iglooEvent.maxGuests} guests and one platter. Explore the October 2026 dates and details.`
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
      ...businessStructuredData,
      image: images,
    },
  ],
} as const
