import { iglooEvent } from './igloo-event.ts'
import { site } from './site.ts'
import { businessId, businessStructuredData, publicSiteOrigin } from './site-schema.ts'

export { publicSiteOrigin, serializeStructuredData } from './site-schema.ts'
export const iglooPageUrl = `${publicSiteOrigin}/igloos`
export const iglooPageTitle = `Igloo Evenings in Clyde, NY | ${site.name}`
export const iglooPageDescription = `Enjoy illuminated igloos and outdoor dining at ${site.name} in Clyde, NY through November. See the Sodus Street Studio Under the Stars details on Eventbrite.`
const serviceId = `${iglooPageUrl}#experience`
const images = ['/images/igloo-hero.jpg', '/images/igloo-entrance.jpg', '/images/igloo-interior.jpg']
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
      description: 'Outdoor dining in an illuminated private igloo. See the current event details on Eventbrite.',
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
