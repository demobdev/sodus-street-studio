import { useEffect } from 'react'
import {
  iglooJsonLd, iglooPageDescription, iglooPageTitle, iglooPageUrl,
  studioPageDescription, studioPageTitle,
} from '../content/igloo-schema'

export function IglooPageMetadata() {
  useEffect(() => {
    document.title = iglooPageTitle
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = iglooPageDescription

    // Reuse the initial HTML nodes on a direct visit, and create them for SPA
    // navigation. Removing both on unmount prevents igloo metadata leaking onto
    // the studio or private reservation pages.
    const canonical = document.getElementById('igloo-canonical') ?? document.createElement('link')
    canonical.id = 'igloo-canonical'
    canonical.setAttribute('rel', 'canonical')
    canonical.setAttribute('href', iglooPageUrl)
    document.head.appendChild(canonical)

    const schema = document.getElementById('igloo-structured-data') ?? document.createElement('script')
    schema.id = 'igloo-structured-data'
    schema.setAttribute('type', 'application/ld+json')
    schema.textContent = iglooJsonLd
    document.head.appendChild(schema)

    return () => {
      document.title = studioPageTitle
      if (description) description.content = studioPageDescription
      canonical.remove()
      schema.remove()
    }
  }, [])

  return null
}
