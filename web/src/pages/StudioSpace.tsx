import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { equipmentList } from '../content/services'
import { site } from '../content/site'

const galleryItems = [
  { label: 'Studio Room', src: '/images/mock-studio-room.png' },
  { label: 'Recording Setup', src: '/images/mock-control.png' },
  { label: 'Podcast Setup', src: '/images/mock-podcast-setup.png' },
  { label: 'Microphones', src: '/images/mock-microphone.png' },
  { label: 'Headphones', src: '/images/mock-headphones.png' },
  { label: 'Seating Area', src: '/images/mock-lounge.png' },
]

export function StudioSpace() {
  return (
    <>
      <PageHero
        label="Studio Space"
        title="A Creative Space Built for Focus, Comfort, and Quality"
        description="Sodus Street Studio offers a warm, professional environment where creators can record, collaborate, and bring projects to life."
        image="/images/page-hero-studio.png"
      >
        <Link to="/booking" className="btn-primary">Check Availability</Link>
        <Link to="/booking" className="btn-secondary">Book a Session</Link>
      </PageHero>

      <section className="section-pad">
        <div className="container-site">
          <p className="section-label">Photo Gallery</p>
          <h2 className="display-title mt-3">Inside the Studio</h2>
          <p className="mt-4 text-navy-muted">
            Mock imagery for the meeting demo — real studio photography will replace these once available.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galleryItems.map((item) => (
              <div
                key={item.label}
                className="relative min-h-44 overflow-hidden bg-navy md:min-h-52"
              >
                <img
                  src={item.src}
                  alt={`${item.label} mock studio photo`}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 text-xs uppercase tracking-[0.16em] text-ivory/90">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-ivory-warm">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <p className="section-label">Equipment List</p>
            <h2 className="display-title mt-3">Tools Built for Clean Sound</h2>
            <ul className="mt-8 space-y-3">
              {equipmentList.map((item) => (
                <li key={item} className="border-b border-navy/10 pb-3 text-navy-muted">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="section-label">Creative Environment</p>
            <h2 className="display-title mt-3">
              Professional, Approachable, Comfortable
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-navy-muted">
              The studio is designed to feel welcoming for first-time creators and
              capable for experienced artists. Expect a focused room with acoustic
              treatment, reliable gear, and guidance when you need it.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-navy-muted">
              Room layout details and a full equipment confirmation will be added
              as the build-out is finalized.
            </p>
          </div>
        </div>
      </section>

      <section id="rules" className="section-pad">
        <div className="container-site">
          <p className="section-label">Studio Rules</p>
          <h2 className="display-title mt-3">Respect the Space. Protect the Sound.</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {site.studioRules.map((rule) => (
              <li key={rule} className="border border-navy/10 bg-white px-5 py-4">
                {rule}
              </li>
            ))}
          </ul>
          <Link to="/booking" className="btn-primary mt-10">
            Book a Session
          </Link>
        </div>
      </section>
    </>
  )
}
