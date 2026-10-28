export function IglooPromoVideo() {
  return (
    <section id="igloo-video" aria-labelledby="igloo-video-title" className="section-pad scroll-mt-28 border-b border-navy/10 bg-ivory-warm">
      <div className="container-site grid items-center gap-8 lg:grid-cols-[0.8fr_1.4fr] lg:gap-14">
        <div>
          <p className="section-label">A look inside</p>
          <h2 id="igloo-video-title" className="display-title mt-3">See the igloos come to life.</h2>
          <p className="mt-5 text-lg leading-relaxed text-navy-muted">
            Take a short look inside the illuminated igloos at Sodus Street Studio.
          </p>
          <p className="mt-4 text-sm text-navy-muted">
            10-second portrait video · Audio is included
          </p>
        </div>
        <figure className="mx-auto w-full max-w-[28rem]">
          <div className="aspect-[3/4] overflow-hidden border border-gold/40 bg-navy shadow-soft">
            <video
              controls
              playsInline
              preload="none"
              poster="/images/igloo-video-poster.jpg"
              width={1440}
              height={1920}
              aria-label="10-second portrait video of the Sodus Street Studio igloo experience"
              className="h-full w-full bg-navy object-contain"
            >
              <source src="/videos/igloo-promo.mp4" type="video/mp4" />
              Your browser does not support this video.{' '}
              <a href="/videos/igloo-promo.mp4">Open the igloo video.</a>
            </video>
          </div>
          <figcaption className="mt-3 text-sm text-navy-muted">
            Use the video controls to play or pause the clip.
          </figcaption>
          <p className="mt-2 text-sm text-navy-muted">
            Having trouble with playback?{' '}
            <a href="/videos/igloo-promo.mp4" className="font-medium text-navy underline decoration-gold underline-offset-4">
              Open the video in a new tab <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </figure>
      </div>
    </section>
  )
}
