import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { site, whoWeServe } from '../content/site'

export function About() {
  return (
    <>
      <PageHero
        label="About"
        title="Built for Local Creators. Designed for Big Ideas."
        description="Sodus Street Studio gives artists, podcasters, storytellers, and entrepreneurs a professional creative space rooted in the heart of Clyde, NY."
        image="/images/page-hero-about.png"
      />

      <section className="section-pad">
        <div className="container-site max-w-3xl">
          <p className="section-label">Our Story</p>
          <h2 className="display-title mt-3">Creativity Deserves a Home Nearby</h2>
          <p className="mt-6 text-lg leading-relaxed text-navy-muted">
            Sodus Street Studio was born from a simple belief: every community
            deserves a place where creativity can take root and grow. What began
            as an empty room in the heart of Clyde became a warm, intimate
            multimedia studio designed for storytellers, musicians, podcasters,
            and dreamers who needed somewhere to bring their ideas to life.
          </p>
        </div>
      </section>

      <section className="section-pad bg-ivory-warm">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <p className="section-label">Our Mission</p>
            <h2 className="display-title mt-3">Welcome In. Create Freely.</h2>
            <p className="mt-6 text-lg leading-relaxed text-navy-muted">
              Our mission is to provide a welcoming, high-quality creative space
              where artists, storytellers, and entrepreneurs can bring their ideas
              to life. We are committed to accessible recording services,
              thoughtful guidance, and an environment designed to inspire authentic
              expression.
            </p>
          </div>
          <div>
            <p className="section-label">Creative Philosophy</p>
            <h2 className="display-title mt-3">Support First. Excellence Always.</h2>
            <p className="mt-6 text-lg leading-relaxed text-navy-muted">
              Sodus Street Studio believes great work happens when creators feel
              supported, comfortable, and understood. Every detail of the studio,
              from the equipment to the collaboration process, is designed to
              nurture creativity, clarity, and excellence.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site">
          <p className="section-label">Clyde Community Connection</p>
          <h2 className="display-title mt-3">
            Historic Character. Modern Creative Tools.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-navy-muted">
            Sodus Street Studio blends Clyde’s historic character with a modern
            creative environment, giving local creators access to professional
            tools, technology, and support without needing big-city resources.
          </p>
        </div>
      </section>

      <section className="section-pad bg-navy text-ivory">
        <div className="container-site">
          <p className="section-label text-gold-light">Who the Studio Serves</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Creators at Every Stage
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {whoWeServe.map((item) => (
              <div
                key={item}
                className="border border-ivory/15 px-5 py-4 text-ivory/85"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/booking" className="btn-primary">
              Book a Session
            </Link>
            <Link to="/services" className="btn-secondary">
              Explore Services
            </Link>
          </div>
          <p className="mt-8 text-sm text-ivory/50">{site.address.line1}, {site.address.line2}</p>
        </div>
      </section>
    </>
  )
}
