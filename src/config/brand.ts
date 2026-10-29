/**
 * Brand configuration.
 *
 * The product name is under review — see docs/BRAND.md. Everything that renders
 * the name reads it from here, so changing it is one commit with no refactor.
 * Nothing else in the codebase hardcodes it.
 */
export const brand = {
  /** Full product name. */
  name: 'Ballast',
  /** Short form for the icon label and tight spaces. Keep ≤ 12 characters. */
  shortName: 'Ballast',
  /** App Store / PWA subtitle. This carries discoverability, not the name. */
  tagline: 'Offline emergency preparedness',
  /**
   * One line, shown on the install prompt and the about screen.
   * The register is a competent friend, not a doomsday marketer.
   */
  description:
    'What is happening near you, what to do in the next hour, and what to buy before the shelves empty. Works with the radio off.',
  themeColor: '#0b0e11',
  backgroundColor: '#0b0e11',
} as const;
