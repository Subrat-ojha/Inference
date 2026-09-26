export type WeekendEvent = {
  id: string
  title: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  location: string
  description: string
  admission: string
  registrationUrl: string
  sourceUrl: string
}

// Reviewed against current organizer or ticket listings on 26 September 2026.
export const hyderabadWeekendEvents: WeekendEvent[] = [
  {
    id: '11111111-1111-4111-8111-111111111001',
    title: 'Startup Smash — Hyderabad',
    date: '2026-10-03',
    endDate: '2026-10-03',
    startTime: '15:00',
    endTime: '19:00',
    location: 'Hyderabad · exact venue not listed',
    description: 'A casual, networking-first gathering for founders, developers, and product builders. The listing says free; confirm the venue in the RSVP details.',
    admission: 'Free listing · RSVP required',
    registrationUrl: 'https://www.eventbrite.com/e/startup-smash-craziest-startup-event-of-hyderabad-tickets-1999852873780',
    sourceUrl: 'https://www.startupgrantsindia.com/events/startup-smash-craziest-startup-event-of-hyderabad-5',
  },
  {
    id: '11111111-1111-4111-8111-111111111002',
    title: 'QAlChemy Expo 2026',
    date: '2026-10-10',
    endDate: '2026-10-10',
    startTime: '',
    endTime: '',
    location: 'FINT Dallas Center, Raidurg, HITEC City',
    description: 'A full-day QA and technology community event with talks, demos, an AI and security track, and a hands-on workshop. Limited seats; registration is required.',
    admission: 'Free entry · register in advance',
    registrationUrl: 'https://forms.cloud.microsoft/r/tsdH9BT1mR',
    sourceUrl: 'https://qalchemy.fintinc.com/',
  },
  {
    id: '11111111-1111-4111-8111-111111111003',
    title: 'TTF Hyderabad 2026',
    date: '2026-10-10',
    endDate: '2026-10-11',
    startTime: '14:00',
    endTime: '18:00',
    location: 'Hall 2, HITEX Exhibition Centre',
    description: 'Travel trade show with tourism boards, hotels, airlines, and holiday destinations. Saturday is 2–6 PM; Sunday is 11 AM–6 PM. Advance registration is complimentary; walk-in registration costs ₹50.',
    admission: 'Free with advance registration',
    registrationUrl: 'https://in.bookmyshow.com/events/ttf-hyderabad-2026/ET00515798',
    sourceUrl: 'https://in.bookmyshow.com/events/ttf-hyderabad-2026/ET00515798',
  },
  {
    id: '11111111-1111-4111-8111-111111111004',
    title: 'Manthan Samvaad 2026',
    date: '2026-10-11',
    endDate: '2026-10-11',
    startTime: '09:00',
    endTime: '18:00',
    location: 'Shilpakala Vedika, Hyderabad',
    description: 'A day of public talks and discussion. Registration is limited to 1,200 attendees; the organizer says attendance and lunch are free.',
    admission: 'Free · registration required',
    registrationUrl: 'https://www.manthansamvaad.com/',
    sourceUrl: 'https://www.manthansamvaad.com/',
  },
]
