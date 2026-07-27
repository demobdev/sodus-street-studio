import { useState } from 'react'
import type { FaqItem } from '../content/faq'

type Props = {
  items: FaqItem[]
}

export function Accordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="divide-y divide-navy/10 border-y border-navy/10">
      {items.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div key={item.question}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <span className="font-display text-xl font-semibold text-navy md:text-2xl">
                {item.question}
              </span>
              <span
                className={`text-gold transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                aria-hidden
              >
                +
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl text-base leading-relaxed text-navy-muted">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
