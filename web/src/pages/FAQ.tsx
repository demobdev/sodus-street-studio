import { Link } from 'react-router-dom'
import { Accordion } from '../components/Accordion'
import { PageHero } from '../components/PageHero'
import { faqCategories } from '../content/faq'

export function FAQ() {
  return (
    <>
      <PageHero
        label="FAQ"
        title="Questions Before You Book?"
        description="Answers for first-time creators, returning clients, and anyone deciding which session is right for their project."
        image="/images/page-hero-faq.png"
      />

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
