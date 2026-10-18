import { faqCategories } from './faq.ts'
import { iglooPageDescription, iglooPageTitle, iglooPageUrl, iglooStructuredData } from './igloo-schema.ts'
import { services } from './services.ts'
import { site } from './site.ts'
import {
  businessId, businessStructuredData, publicSiteOrigin, serializeStructuredData,
  studioPageDescription, studioPageTitle, websiteId, websiteStructuredData,
} from './site-schema.ts'

export type PageMetadata = {
  path: string
  title: string
  description: string
  canonical?: string
  structuredData?: Record<string, unknown>
  noindex?: boolean
}

function publicPage(
  path: string,
  title: string,
  description: string,
  type = 'WebPage',
  properties: Record<string, unknown> = {},
  entities: Record<string, unknown>[] = [],
): PageMetadata {
  const url = `${publicSiteOrigin}${path}`
  return {
    path, title, description, canonical: url,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': type, '@id': `${url}#webpage`, url, name: title,
          description, inLanguage: 'en-US',
          isPartOf: { '@id': websiteId },
          publisher: { '@id': businessId },
          about: { '@id': businessId },
          ...properties,
        },
        websiteStructuredData,
        businessStructuredData,
        ...entities,
      ],
    },
  }
}

const serviceEntities = services.map(service => ({
  '@type': 'Service',
  '@id': `${publicSiteOrigin}/services#${service.id}`,
  url: `${publicSiteOrigin}/services#${service.id}`,
  name: service.title,
  serviceType: service.title,
  description: service.description,
  provider: { '@id': businessId },
  mainEntityOfPage: { '@id': `${publicSiteOrigin}/services#webpage` },
}))

// This registry is shared by the initial HTML build and React navigation so
// crawlers and visitors receive the same page identity on every entry path.
export const publicPages: PageMetadata[] = [
  publicPage('/', studioPageTitle, studioPageDescription, 'WebPage', {
    mainEntity: { '@id': businessId },
  }),
  {
    path: '/igloos', title: iglooPageTitle, description: iglooPageDescription,
    canonical: iglooPageUrl,
    structuredData: {
      ...iglooStructuredData,
      '@graph': [
        { ...iglooStructuredData['@graph'][0], isPartOf: { '@id': websiteId } },
        ...iglooStructuredData['@graph'].slice(1),
        websiteStructuredData,
      ],
    },
  },
  publicPage('/about', `About the Studio | ${site.name}`,
    'Meet Sodus Street Studio, a welcoming multimedia studio for artists, podcasters, storytellers and entrepreneurs in Clyde, NY.',
    'AboutPage', { mainEntity: { '@id': businessId } }),
  publicPage('/services', `Recording & Production Services | ${site.name}`,
    'Explore podcast and voiceover recording, audio editing, music production, mixing, mastering, studio rental and creative support in Clyde, NY.',
    'CollectionPage', { mainEntity: serviceEntities.map(service => ({ '@id': service['@id'] })) }, serviceEntities),
  publicPage('/studio-space', `Studio Space in Clyde, NY | ${site.name}`,
    'Explore the recording environment, equipment and studio guidelines at Sodus Street Studio in Clyde, NY.'),
  publicPage('/portfolio', `Portfolio & Upcoming Samples | ${site.name}`,
    'Podcast clips, voiceover demos, music recordings and project highlights are coming soon to the Sodus Street Studio portfolio.',
    'CollectionPage'),
  publicPage('/booking', `Request a Studio Session | ${site.name}`,
    'Choose a studio session, review hourly and full-day rates, and send a request. The studio will follow up with availability and payment details.'),
  publicPage('/faq', `Studio & Booking FAQ | ${site.name}`,
    'Answers about studio session requests, services, recording preparation, guests, cancellation policies and parking at Sodus Street Studio.',
    'FAQPage', {
      mainEntity: faqCategories.flatMap(category => category.items).map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    }),
  publicPage('/contact', `Contact the Studio | ${site.name}`,
    'Contact Sodus Street Studio at 28 Sodus Street, Clyde, NY 14433. Send a question about recording, studio sessions or your next creative project.',
    'ContactPage'),
  publicPage('/privacy-policy', `Privacy Policy | ${site.name}`,
    'Learn how Sodus Street Studio collects, uses and protects information submitted through its website, inquiry forms and booking system.'),
  publicPage('/terms-and-conditions', `Terms & Conditions | ${site.name}`,
    'Read Sodus Street Studio website terms, booking and payment policies, cancellation requirements, studio rules and equipment guidelines.'),
]

export const privatePages: PageMetadata[] = [
  { path: '/igloos/manage', title: `Manage Your Reservation | ${site.name}` },
  { path: '/igloos/confirmation', title: `Reservation Details | ${site.name}` },
  { path: '/igloos/test-checkout', title: `Test Checkout | ${site.name}` },
].map(page => ({ ...page, description: 'Private reservation tools for Sodus Street Studio.', noindex: true }))

export function metadataForPath(pathname: string): PageMetadata {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  return [...publicPages, ...privatePages].find(page => page.path === path)
    ?? { path, title: studioPageTitle, description: studioPageDescription, noindex: true }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function pageMetadataHtml(html: string, metadata: PageMetadata) {
  const tags = [
    metadata.canonical && `<link id="site-canonical" rel="canonical" href="${escapeHtml(metadata.canonical)}" />`,
    metadata.structuredData && `<script id="site-structured-data" type="application/ld+json">${serializeStructuredData(metadata.structuredData)}</script>`,
    metadata.noindex && '<meta id="site-robots" name="robots" content="noindex, nofollow" />',
  ].filter(Boolean).join('\n    ')

  return html
    .replace(/<(?:link|meta)\b[^>]*\bid="site-(?:canonical|robots)"[^>]*>/g, '')
    .replace(/<script\b[^>]*\bid="site-structured-data"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(metadata.description)}" />`)
    .replace('</head>', `    ${tags}\n  </head>`)
}
