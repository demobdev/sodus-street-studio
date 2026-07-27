export type FaqItem = {
  question: string
  answer: string
}

export type FaqCategory = {
  title: string
  items: FaqItem[]
}

export const faqPreview: FaqItem[] = [
  {
    question: 'Do I need recording experience?',
    answer:
      'No. We welcome first-time creators and guide you through the process so you can focus on your story.',
  },
  {
    question: 'What should I bring to my session?',
    answer:
      'Bring any scripts, notes, instruments, or reference tracks you need. We will confirm gear and setup details when you book.',
  },
  {
    question: 'Can I bring guests?',
    answer:
      'Yes — guests must be approved in advance so we can prepare the space and keep sessions comfortable.',
  },
  {
    question: 'Do you offer mixing and mastering?',
    answer:
      'Yes. Mixing and mastering are available as post-production services to polish your final sound.',
  },
  {
    question: 'Can I book the studio for a full day?',
    answer:
      'Yes. Full-day sessions are $500 per day and are ideal for multi-episode recording, music projects, and content batching.',
  },
  {
    question: 'What is your cancellation policy?',
    answer:
      'Cancellations require at least 24 hours notice. Late cancellations may incur a fee.',
  },
  {
    question: 'Can you help me choose the right session?',
    answer:
      'Absolutely. Contact us with your project details and we will recommend the right session type and length.',
  },
]

export const faqCategories: FaqCategory[] = [
  {
    title: 'Booking',
    items: [
      {
        question: 'How do I book a session?',
        answer:
          'Choose your session type on the Booking page, share your preferred date and project details, and submit your request. At launch, live calendar and payment will run through Acuity Scheduling.',
      },
      {
        question: 'Do I pay when I book?',
        answer:
          'Yes. Payment is due upon booking for standard sessions. Larger full-day projects may use a deposit model at launch.',
      },
      {
        question: 'Can I book by the hour?',
        answer: 'Yes. Hourly sessions are $75 per hour.',
      },
      {
        question: 'Can I book the studio for a full day?',
        answer: 'Yes. Full-day bookings are $500 per day.',
      },
      {
        question: 'What is your cancellation policy?',
        answer:
          'Cancellations require at least 24 hours notice. Late cancellations or missed sessions may result in a cancellation fee or forfeited payment.',
      },
    ],
  },
  {
    title: 'Studio Sessions',
    items: [
      {
        question: 'What should I bring to my session?',
        answer:
          'Bring scripts, notes, instruments, hard drives, or reference tracks relevant to your project. Arrive ready to create.',
      },
      {
        question: 'Do I need recording experience?',
        answer:
          'No experience is required. We support beginners and experienced creators alike.',
      },
      {
        question: 'Will someone guide me through the process?',
        answer:
          'Yes. Engineer guidance is available so you feel supported from first take to wrap.',
      },
      {
        question: 'How early should I arrive?',
        answer:
          'Plan to arrive a few minutes early so we can settle in, review the plan, and start on time.',
      },
    ],
  },
  {
    title: 'Services',
    items: [
      {
        question: 'Do you offer podcast recording?',
        answer: 'Yes — solo shows, interviews, conversations, and branded podcasts.',
      },
      {
        question: 'Do you offer voiceover recording?',
        answer:
          'Yes — narration, commercials, training content, social media, and creative VO projects.',
      },
      {
        question: 'Do you offer mixing and mastering?',
        answer: 'Yes. Mixing and mastering are available as post-production services.',
      },
      {
        question: 'Do you help with content production?',
        answer:
          'Yes. We offer content production support for creators and local businesses.',
      },
      {
        question: 'Do you offer creative consulting?',
        answer:
          'Yes. Consulting helps you shape an idea, plan a project, or prepare for recording.',
      },
    ],
  },
  {
    title: 'Guests and Rules',
    items: [
      {
        question: 'Can I bring guests?',
        answer: 'Guests are welcome when approved in advance.',
      },
      {
        question: 'Are food and drinks allowed?',
        answer: 'No food or open drinks near gear. Closed water bottles are preferred.',
      },
      {
        question: 'What are the studio rules?',
        answer:
          'Respect the space and equipment, arrive on time, follow engineer guidance, clean up after your session, and treat everyone with respect.',
      },
    ],
  },
  {
    title: 'First-Time Creators',
    items: [
      {
        question: 'I have never recorded before. Can you help me?',
        answer:
          'Yes. Sodus Street Studio is built to welcome first-time creators with guidance and a comfortable environment.',
      },
      {
        question: 'Can you help me prepare for my first podcast?',
        answer:
          'Absolutely. We can help with setup planning, session structure, and recording confidence.',
      },
      {
        question: 'Can you help me figure out what type of session I need?',
        answer:
          'Yes. Reach out through the Contact page and we will recommend the best fit.',
      },
    ],
  },
  {
    title: 'Location and Parking',
    items: [
      {
        question: 'Where is Sodus Street Studio located?',
        answer: '28 Sodus Street, Clyde, NY 14433.',
      },
      {
        question: 'Is parking available?',
        answer:
          'On-street parking is available in front of and beside the building.',
      },
      {
        question: 'How do I contact the studio?',
        answer:
          'Use the Contact page form and we will respond to help you choose the right session.',
      },
    ],
  },
]
