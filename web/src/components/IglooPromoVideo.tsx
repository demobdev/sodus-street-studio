import { iglooEvent } from '../content/igloo-event'

export function IglooPromoVideo() {
  return (
    <section id="igloo-video" aria-labelledby="igloo-video-title" className="section-pad scroll-mt-28 border-b border-navy/10 bg-ivory-warm">
      <div className="container-site grid items-center gap-8 lg:grid-cols-[0.8fr_1.4fr] lg:gap-14">
        <div>
          <p className="section-label">Ride to Clyde</p>
          <h2 id="igloo-video-title" className="display-title mt-3">Make an evening of Clyde.</h2>
          <p className="mt-5 text-lg leading-relaxed text-navy-muted">
            A little taste of October around town. Watch Clyde’s community promo,
            then plan your gathering under the stars at Sodus Street Studio.
          </p>
          <p className="mt-4 text-sm text-navy-muted">October community video · 15 seconds</p>
        </div>
        <div className="min-w-0">
          <div className="aspect-video overflow-hidden border border-gold/40 bg-navy shadow-soft">
            <iframe
              src={iglooEvent.video.embedUrl}
              title={iglooEvent.video.title}
              loading="lazy"
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4 text-sm">
            <details className="max-w-lg text-navy-muted">
              <summary className="cursor-pointer font-medium text-navy underline decoration-gold underline-offset-4">Read the video transcript</summary>
              <p className="mt-3 leading-relaxed">{iglooEvent.video.transcript}</p>
            </details>
            <a href={iglooEvent.video.url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy underline decoration-gold underline-offset-4 hover:text-gold-dark">
              Watch on Vimeo <span className="sr-only">(opens a new tab)</span><span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
