// Event details supplied by Maát on October 15, 2026.
// Publishing this content does not enable payment collection or open inventory.
export const iglooEvent = {
  title: 'Sodus Street Studio Under the Stars',
  priceCents: 22500,
  currency: 'usd',
  maxGuests: 8,
  durationMinutes: 90,
  capacityPerSeating: 4,
  timeZone: 'America/New_York',
  dates: [
    { date: '2026-10-23', label: 'Friday, October 23', day: '23', note: '' },
    { date: '2026-10-24', label: 'Saturday, October 24', day: '24', note: '' },
    { date: '2026-10-30', label: 'Friday, October 30', day: '30', note: '' },
    { date: '2026-10-31', label: 'Saturday, October 31', day: '31', note: 'Halloween evening' },
  ],
  seatings: [
    { start: '17:00', end: '18:30', label: '5–6:30 p.m.' },
    { start: '19:00', end: '20:30', label: '7–8:30 p.m.' },
    { start: '21:00', end: '22:30', label: '9–10:30 p.m.' },
  ],
  platters: [
    { id: 'classic-sub-tray', name: 'Classic Sub Tray', description: 'A platter of subs to share around the table.' },
    { id: 'charcuterie-experience', name: 'Charcuterie Experience', description: 'A selection of meats, cheeses, and accompaniments.' },
    { id: 'italian-favorites', name: 'Italian Favorites', description: 'Meatballs and mozzarella Caprese.' },
    { id: 'casual-favorites-platter', name: 'Casual Favorites Platter', description: 'Burgers and chicken fingers.' },
  ],
  video: {
    title: 'Ride to Clyde — October community promo',
    embedUrl: 'https://player.vimeo.com/video/1236354271?h=418634721b&autoplay=0&dnt=1',
    url: 'https://vimeo.com/1236354271',
    transcript: "This October, something's stirring in Clyde. Come alive with food, fun, and hometown surprises. Haunted history, spooky thrills, and unforgettable nights all around town. Weekends in October. Take a ride to Clyde.",
  },
} as const
