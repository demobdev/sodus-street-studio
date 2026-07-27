import type { ReactNode } from 'react'

type Props = {
  label: string
  title: string
  description: string
  image: string
  children?: ReactNode
}

export function PageHero({ label, title, description, image, children }: Props) {
  return (
    <section className="relative overflow-hidden bg-navy text-ivory">
      <img
        src={image}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-navy/92 via-navy/75 to-navy/40"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-navy/35"
        aria-hidden
      />
      <div className="relative container-site px-5 py-20 md:px-8 md:py-24 lg:px-12">
        <p className="section-label text-gold-light">{label}</p>
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold md:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ivory/85">{description}</p>
        {children ? <div className="mt-8 flex flex-wrap gap-4">{children}</div> : null}
      </div>
    </section>
  )
}
