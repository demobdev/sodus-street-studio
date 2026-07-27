import { Link } from 'react-router-dom'

const sampleTypes = [
  'Podcast clips',
  'Voiceover demos',
  'Music recordings',
  'Edited audio samples',
  'Branded content samples',
  'Before-and-after examples',
]

export function Portfolio() {
  return (
    <>
      <section className="bg-navy px-5 py-20 text-ivory md:px-8 lg:px-12">
        <div className="container-site">
          <p className="section-label text-gold-light">Portfolio / Samples</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold md:text-6xl">
            Hear What’s Possible at Sodus Street Studio
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory/75">
            Explore samples from artists, podcasters, voiceover projects, and
            creative sessions recorded or produced at Sodus Street Studio.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site">
          <div className="border border-gold/40 bg-ivory-warm p-10 text-center md:p-16">
            <p className="section-label">Coming Soon</p>
            <h2 className="mt-4 font-display text-4xl text-navy md:text-5xl">
              Portfolio samples coming soon.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-navy-muted">
              We’ll be adding audio clips, podcast samples, voiceover demos, and
              project highlights as new work becomes available.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/booking" className="btn-primary">
                Book a Session
              </Link>
              <Link to="/contact" className="btn-outline">
                Contact Us
              </Link>
            </div>
          </div>

          <div className="mt-14">
            <p className="section-label">Sample Types Planned</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sampleTypes.map((item) => (
                <div key={item} className="border border-navy/10 bg-white px-5 py-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
