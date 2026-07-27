import { site } from '../content/site'

export function Terms() {
  return (
    <section className="section-pad">
      <div className="container-site max-w-3xl">
        <p className="section-label">Legal</p>
        <h1 className="display-title mt-3">Terms & Conditions</h1>
        <div className="mt-8 space-y-6 text-navy-muted leading-relaxed">
          <p>
            By using the Sodus Street Studio website and booking services, you
            agree to the following terms.
          </p>
          <div>
            <h2 className="font-display text-2xl text-navy">Website Use</h2>
            <p className="mt-2">
              Content on this website is provided for informational purposes and
              may be updated as studio offerings evolve.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy">Booking & Payment</h2>
            <p className="mt-2">
              Session bookings are subject to availability. Payment is due upon
              booking unless otherwise arranged for larger projects.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy">Cancellation Policy</h2>
            <p className="mt-2">{site.rates.cancellation}</p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy">Studio Rules</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {site.studioRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy">Equipment Use</h2>
            <p className="mt-2">
              Clients are expected to use studio equipment responsibly and follow
              engineer guidance. Damage caused by misuse may result in repair
              charges.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy">Contact</h2>
            <p className="mt-2">
              Questions about these terms can be submitted through the Contact
              page.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
