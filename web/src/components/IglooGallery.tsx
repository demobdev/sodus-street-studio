const photos = [
  {
    src: '/images/igloo-entrance.jpg',
    alt: 'An illuminated igloo entrance framed by cornstalks, pumpkins and flowers.',
    caption: 'A warm welcome under the string lights.',
  },
  {
    src: '/images/igloo-interior.jpg',
    alt: 'A furnished igloo with curved seating, patterned rug and warm lights.',
    caption: 'Settle in for an evening together.',
  },
  {
    src: '/images/igloo-fireplace.jpg',
    alt: 'A fireplace and seating inside an illuminated igloo.',
    caption: 'A cozy place to gather.',
  },
]

export function IglooGallery() {
  return (
    <section
      id="igloo-gallery"
      className="section-pad border-b border-navy/10 bg-ivory-warm"
      aria-labelledby="igloo-gallery-title"
    >
      <div className="container-site">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="section-label">Sodus Street Studio Under the Stars</p>
            <h2 id="igloo-gallery-title" className="display-title mt-3 max-w-lg">
              An evening made for gathering.
            </h2>
          </div>
          <p className="max-w-md leading-relaxed text-navy-muted">
            Step inside a softly lit igloo and enjoy outdoor dining in Clyde.
          </p>
        </div>
        <div className="mt-9 grid gap-6 md:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.src} className="min-w-0">
              <img
                src={photo.src}
                alt={photo.alt}
                width={1448}
                height={1086}
                loading="lazy"
                decoding="async"
                className="block aspect-[4/3] w-full object-cover"
              />
              <figcaption className="mt-3 text-sm font-medium text-navy-muted">
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
