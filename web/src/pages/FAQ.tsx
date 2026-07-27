import { Link } from 'react-router-dom'
import { Accordion } from '../components/Accordion'
import { faqCategories } from '../content/faq'

export function FAQ() {
  return (
    <>
      <section className="bg-navy px-5 py-20 text-ivory md:px-8 lg:px-12">
        <div className="container-site">
          <p className="section-label text-gold-light">FAQ</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold md:text-6xl">
            Questions Before You Book?
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory/75">
            Answers for first-time creators, returning clients, and anyone
            deciding which session is right for their project.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site space-y-14">
          {faqCategories.map((category) => (
            <div key={category.title}>
              <h2 className="font-display text-3xl text-navy md:text-4xl">
                {category.title}
              </h2>
              <div className="mt-6">
                <Accordion items={category.items} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-4">
            <Link to="/booking" className="btn-primary">Book a Session</Link>
            <Link to="/contact" className="btn-outline">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  )
}
