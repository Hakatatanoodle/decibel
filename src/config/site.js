// ---------------------------------------------------------------------------
// Single source of truth for the site origin and shared navigation.
//
// TODO: Replace SITE_URL with your production domain before launch.
//       Everything that needs an absolute URL reads from here — canonical
//       tags, Open Graph tags, the sitemap integration, and (via the
//       prebuild note in public/robots.txt) the robots.txt sitemap line.
// ---------------------------------------------------------------------------

export const SITE_URL = 'https://example.com';

export const SITE_NAME = 'Decibel';
export const SITE_TAGLINE = 'Online Decibel Meter';
export const CONTACT_EMAIL = 'hello@example.com'; // TODO: real contact address

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/classroom-noise-meter/', label: 'Classroom' },
  { href: '/sound-level-meter/', label: 'Sound Level' },
  { href: '/about-us/', label: 'About' },
  { href: '/contact-us/', label: 'Contact' },
  { href: '/privacy-policy/', label: 'Privacy' },
  { href: '/terms-and-conditions/', label: 'Terms' },
];

export const FOOTER_PRODUCT = [
  { href: '/', label: 'Online Decibel Meter' },
  { href: '/classroom-noise-meter/', label: 'Classroom Noise Meter' },
  { href: '/sound-level-meter/', label: 'Sound Level Meter' },
];

export const FOOTER_COMPANY = [
  { href: '/about-us/', label: 'About Us' },
  { href: '/contact-us/', label: 'Contact Us' },
];

export const FOOTER_LEGAL = [
  { href: '/privacy-policy/', label: 'Privacy Policy' },
  { href: '/terms-and-conditions/', label: 'Terms & Conditions' },
];
