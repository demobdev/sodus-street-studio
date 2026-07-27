export type SessionType = {
  id: string
  title: string
  summary: string
  description: string
  rateLabel: string
  rateNote: string
  durations: string[]
  bestFor: string[]
  includes: string[]
  intakeHints: string[]
}

export const sessions: SessionType[] = [
  {
    id: 'podcast',
    title: 'Podcast Recording',
    summary: 'Solo shows, interviews, conversations, and branded podcasts.',
    description:
      'Record clean, professional podcast audio with guidance through setup, levels, and session flow—whether you are starting your first episode or batching a season.',
    rateLabel: '$75 / hour',
    rateNote: 'Payment is due upon booking.',
    durations: ['1 hour', '2 hours', '3 hours'],
    bestFor: ['Solo podcasts', 'Interviews', 'Branded shows', 'Multi-guest episodes'],
    includes: [
      'Podcast-ready recording setup',
      'Engineer guidance as needed',
      'Comfortable session pacing',
    ],
    intakeHints: [
      'Podcast name',
      'Number of speakers',
      'Episode topic',
      'Guest attendance',
      'Editing or multi-camera needs',
    ],
  },
  {
    id: 'voiceover',
    title: 'Voiceover Recording',
    summary: 'Narration, commercials, training content, and creative VO.',
    description:
      'Capture clear voiceover takes in a focused recording environment built for clean delivery and efficient script work.',
    rateLabel: '$75 / hour',
    rateNote: 'Payment is due upon booking.',
    durations: ['1 hour', '2 hours'],
    bestFor: ['Commercials', 'Narration', 'Training audio', 'Social content'],
    includes: [
      'Quiet VO recording setup',
      'Support for scripted sessions',
      'File delivery guidance',
    ],
    intakeHints: [
      'Project type',
      'Script length',
      'Intended use',
      'Editing needs',
      'Preferred delivery format',
    ],
  },
  {
    id: 'music',
    title: 'Music Recording',
    summary: 'Capture high-quality performances for artists and musicians.',
    description:
      'Book studio time to record vocals, instruments, or full tracking sessions with a setup designed for focus and quality.',
    rateLabel: '$75 / hour',
    rateNote: 'Payment is due upon booking.',
    durations: ['2 hours', '3 hours', '4 hours'],
    bestFor: ['Vocal tracking', 'Instrument sessions', 'Demo recording', 'Artist projects'],
    includes: [
      'Music recording environment',
      'Acoustic treatment',
      'Optional mixing/mastering add-ons',
    ],
    intakeHints: [
      'Artist name',
      'Genre',
      'Number of performers',
      'Instruments involved',
      'Mixing or mastering needs',
    ],
  },
  {
    id: 'production',
    title: 'Audio Production / Editing',
    summary: 'Edit, clean up, and prepare recordings for release.',
    description:
      'Bring raw audio in for editing support—cleanup, flow improvements, distraction removal, and release-ready preparation.',
    rateLabel: '$75 / hour',
    rateNote: 'Payment is due upon booking.',
    durations: ['1 hour', '2 hours', '3 hours'],
    bestFor: ['Podcast editing', 'VO cleanup', 'Content polishing', 'Release prep'],
    includes: [
      'Editing and cleanup support',
      'Structure and pacing help',
      'Export guidance for delivery',
    ],
    intakeHints: [
      'Type of audio',
      'Approximate raw length',
      'Desired final length',
      'Deadline',
      'Delivery format',
    ],
  },
  {
    id: 'rental',
    title: 'Studio Rental',
    summary: 'Hourly studio access for creators who need the room.',
    description:
      'Reserve the studio as your creative workspace. Ideal when you already know your process and need a professional space to work.',
    rateLabel: '$75 / hour',
    rateNote: 'Payment is due upon booking.',
    durations: ['1 hour', '2 hours', '3 hours', '4 hours'],
    bestFor: ['Independent creators', 'Content batching', 'Flexible sessions'],
    includes: [
      'Studio access for your booked time',
      'Core recording environment',
      'Optional engineer support on request',
    ],
    intakeHints: [
      'What you will use the studio for',
      'How many people will attend',
      'Engineer needs',
      'Special setup requests',
    ],
  },
  {
    id: 'consulting',
    title: 'Creative Consulting',
    summary: 'Shape ideas, plan projects, and prepare to record.',
    description:
      'Get guidance before you hit record—session planning, podcast structure, project clarity, and next-step recommendations.',
    rateLabel: '$75 / hour',
    rateNote: 'Payment is due upon booking.',
    durations: ['1 hour', '2 hours'],
    bestFor: ['First-time creators', 'Project planning', 'Pre-record strategy'],
    includes: [
      'One-on-one creative guidance',
      'Session planning support',
      'Clear next-step recommendations',
    ],
    intakeHints: [
      'Project you are working on',
      'Help you need',
      'Whether you are preparing to record',
      'Content planning needs',
    ],
  },
  {
    id: 'full-day',
    title: 'Full-Day Booking',
    summary: 'A full production day for larger creative projects.',
    description:
      'Block the studio for a full day when you need room to work deeply—multi-episode podcasts, music projects, content batching, or longer rentals.',
    rateLabel: '$500 / day',
    rateNote: 'Payment is due upon booking. Larger projects may use a deposit at launch.',
    durations: ['Full-day block'],
    bestFor: [
      'Multi-episode recording',
      'Music production days',
      'Content batching',
      'Longer studio rentals',
    ],
    includes: [
      'Full-day studio access',
      'Room blocked for your project',
      'Support for larger session plans',
    ],
    intakeHints: [
      'Project type',
      'Number of attendees',
      'Desired start time',
      'Services and add-ons needed',
      'Project goals and deadline',
    ],
  },
]

export function getSessionByTitle(title: string): SessionType | undefined {
  return sessions.find((session) => session.title === title)
}
