export type Service = {
  id: string
  title: string
  description: string
}

export const services: Service[] = [
  {
    id: 'podcast',
    title: 'Podcast Recording',
    description:
      'Professional recording support for solo podcasts, interviews, conversations, and branded shows.',
  },
  {
    id: 'voiceover',
    title: 'Voiceover Recording',
    description:
      'Clean, high-quality audio for narration, commercials, training content, social media, and creative projects.',
  },
  {
    id: 'production',
    title: 'Audio Production & Editing',
    description:
      'Editing support to clean up recordings, improve flow, remove distractions, and prepare content for release.',
  },
  {
    id: 'music',
    title: 'Music Production',
    description:
      'Recording support for artists, musicians, and performers looking to capture high-quality sound.',
  },
  {
    id: 'mixing',
    title: 'Mixing & Mastering',
    description:
      'Post-production services to improve balance, clarity, loudness, and final polish.',
  },
  {
    id: 'rental',
    title: 'Studio Rental',
    description:
      'Hourly or full-day studio access for creators who need a professional recording space.',
  },
  {
    id: 'consulting',
    title: 'Creative Consulting',
    description:
      'Support for creators who need help shaping an idea, planning a project, or preparing for a recording session.',
  },
  {
    id: 'content',
    title: 'Content Production Support',
    description:
      'Guidance for creators and businesses developing audio, video, or branded content.',
  },
]

export const addOns = [
  'Remote Recording Support',
  'Multi-Camera Podcast Setup',
  'Post-Production Packages',
]

export const equipmentList = [
  'Microphones',
  'Audio interface',
  'Headphones',
  'Recording software',
  'Acoustic treatment',
  'Multi-camera setup (available on request)',
  'Lighting support (available on request)',
]
