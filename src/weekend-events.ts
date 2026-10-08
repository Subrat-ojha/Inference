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
  checkedOn: string
  registrationRequired?: boolean
}

export const weekendEventsCheckedOn = '2026-10-08'

// Standing preference: Hyderabad, Saturday/Sunday, and zero admission cost.
// Free advance registration is allowed; disclose it and any optional spending.
// Do not add paid venues, mandatory purchases, or unverified "free" listings.
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
    checkedOn: '2026-09-26',
  },
  {
    id: '11111111-1111-4111-8111-111111111002',
    title: 'QAlChemy Expo 2026',
    date: '2026-10-10',
    endDate: '2026-10-10',
    startTime: '09:30',
    endTime: '16:30',
    location: 'FINT Dallas Center, Raidurg, HITEC City',
    description: 'QA, AI, security, and mobile-testing sessions. Lunch and snacks are included. Bring a laptop with the organizer\'s prerequisites for the afternoon MobileWright workshop. Limited seats; register first.',
    admission: 'Free entry, lunch and snacks · registration required',
    registrationUrl: 'https://forms.cloud.microsoft/r/tsdH9BT1mR',
    sourceUrl: 'https://qalchemy.fintinc.com/',
    checkedOn: weekendEventsCheckedOn,
  },
  {
    id: '11111111-1111-4111-8111-111111111003',
    title: 'TTF Hyderabad 2026',
    date: '2026-10-10',
    endDate: '2026-10-11',
    startTime: '',
    endTime: '',
    location: 'Hall 2, HITEX Exhibition Centre',
    description: 'Travel exhibition with tourism boards, hotels, and holiday destinations. Saturday: 14:00–18:00; Sunday: 11:00–18:00 IST. Ages 16+. Get the complimentary pass before going: walk-in registration costs ₹50. No holiday purchase is needed to browse.',
    admission: '₹0 advance pass only · walk-ins cost ₹50',
    registrationUrl: 'https://in.bookmyshow.com/events/ttf-hyderabad-2026/ET00515798',
    sourceUrl: 'https://in.bookmyshow.com/events/ttf-hyderabad-2026/ET00515798',
    checkedOn: weekendEventsCheckedOn,
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
    checkedOn: weekendEventsCheckedOn,
  },
  {
    id: '11111111-1111-4111-8111-111111111005',
    title: 'VueVerse Offline Connect',
    date: '2026-10-10',
    endDate: '2026-10-10',
    startTime: '10:00',
    endTime: '14:00',
    location: 'T-Hub Phase 2, Madhapur, Hyderabad',
    description: 'Developer talks and networking from the VueVerse community, open to students, developers, and curious beginners. The organizer lists 10:00–14:00 IST on Meetup. Request a place on Luma and wait for host approval before travelling.',
    admission: 'Free for everyone · registration and host approval required',
    registrationUrl: 'https://luma.com/hsx75190',
    sourceUrl: 'https://www.meetup.com/vueverse/events/316704993/',
    checkedOn: weekendEventsCheckedOn,
  },
  {
    id: '11111111-1111-4111-8111-111111111006',
    title: 'UK & Europe Education Fair',
    date: '2026-10-10',
    endDate: '2026-10-10',
    startTime: '10:00',
    endTime: '16:00',
    location: 'Hyatt Place Hyderabad, Banjara Hills',
    description: 'Orient Spectra\'s study-abroad fair with university and course guidance, profile evaluation, and information about scholarships and applications. The fair is free to attend; studying abroad and any later services are separate. Use the organizer\'s registration form.',
    admission: 'Free entry · advance registration available',
    registrationUrl: 'https://orientspectra.com/event/uk-europe-education-fair/',
    sourceUrl: 'https://orientspectra.com/event/uk-europe-education-fair/',
    checkedOn: weekendEventsCheckedOn,
  },
  {
    id: '11111111-1111-4111-8111-111111111007',
    title: 'Vibe Sprint · The Product Folks × Scaler',
    date: '2026-10-11',
    endDate: '2026-10-11',
    startTime: '12:00',
    endTime: '16:00',
    location: 'T-Hub, Hyderabad · exact address after approval',
    description: 'Build an idea using AI tools with mentors and other builders. No coding background is required; bring a charged laptop. Food and drinks are included. Places require host approval; use free tools or your existing access to keep your visit at ₹0 admission.',
    admission: 'Free entry, food and drinks · approval required',
    registrationUrl: 'https://luma.com/kusscty4',
    sourceUrl: 'https://luma.com/kusscty4',
    checkedOn: weekendEventsCheckedOn,
  },
  {
    id: '11111111-1111-4111-8111-111111111008',
    title: 'IDP Australia & New Zealand Study Abroad Expo',
    date: '2026-10-17',
    endDate: '2026-10-17',
    startTime: '11:00',
    endTime: '16:00',
    location: 'The Park Hyderabad, Raj Bhavan Road, Somajiguda',
    description: 'Meet university representatives and explore courses, entry requirements, and scholarships. IDP and participating university Curtin list 11:00–16:00 IST; some event directories say 10:00, so follow your registration confirmation. Attendance is free; degree programmes are not.',
    admission: 'Free attendance · register with IDP',
    registrationUrl: 'https://form.idp.com/india/63EXSCjXTkhXafsJVI0iXB/',
    sourceUrl: 'https://www.curtin.edu.au/events/meet-curtin-in-india/',
    checkedOn: weekendEventsCheckedOn,
  },
  {
    id: '11111111-1111-4111-8111-111111111009',
    title: 'KBCA Durga Puja · weekend visit',
    date: '2026-10-17',
    endDate: '2026-10-18',
    startTime: '',
    endTime: '',
    location: 'CCRT, Kondapur, Hyderabad',
    description: 'Visit the free-entry Durga Puja celebration on Saturday (Saptami) or Sunday (Ashtami). The full festival runs 16–21 October; only its weekend dates are saved here. Exact visiting hours are not published. Entry is free; food/bhog coupons and membership benefits are separate. The paid 11 October Adhibas lunch is a different event.',
    admission: 'Free festival entry · food and purchases optional',
    registrationUrl: 'https://www.kbcahyd.co.in/',
    sourceUrl: 'https://www.kbcahyd.co.in/',
    checkedOn: weekendEventsCheckedOn,
    registrationRequired: false,
  },
]
