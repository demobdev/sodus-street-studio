import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { metadataForPath } from '../content/page-metadata'
import { serializeStructuredData } from '../content/site-schema'

export function PageMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = metadataForPath(pathname)
    document.title = metadata.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = metadata.description

    // One owner for initial HTML and SPA navigation, including private pages.
    // Replacing the previous route's nodes avoids stale or duplicate metadata.
    document.querySelectorAll('#site-canonical, #site-structured-data, #site-robots').forEach(node => node.remove())
    if (metadata.canonical) {
      const canonical = document.createElement('link')
      canonical.id = 'site-canonical'
      canonical.rel = 'canonical'
      canonical.href = metadata.canonical
      document.head.appendChild(canonical)
    }
    if (metadata.structuredData) {
      const schema = document.createElement('script')
      schema.id = 'site-structured-data'
      schema.type = 'application/ld+json'
      schema.textContent = serializeStructuredData(metadata.structuredData)
      document.head.appendChild(schema)
    }
    if (metadata.noindex) {
      const robots = document.createElement('meta')
      robots.id = 'site-robots'
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.appendChild(robots)
    }
  }, [pathname])

  return null
}
