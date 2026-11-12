export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'The Collision Justice',
  logo: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || '/brand-logo.png',
  email: 'Info@thecollisionjustice.com',
  phone: '434-849-6895',
  phoneHref: '+14348496895',
  address: {
    streetAddress: '310 Oakley Avenue',
    addressLocality: 'Lynchburg',
    addressRegion: 'VA',
    postalCode: '24501',
    addressCountry: 'US',
  },
  disclosure: 'Advertising by a legal marketing service. No attorney-client relationship is formed.',
};

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thecollisionjustice.com').replace(/\/$/, '');

export const CLAIM_STATUSES = ['New Intake', 'Reviewing Docs', 'Assigned', 'Filed', 'Closed'] as const;
export const ACCIDENT_TYPES = ['Rear-End', 'Side-Impact', 'Multi-Vehicle', 'Hit & Run', 'Other'] as const;
export const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
  ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

export const FAQS = [
  ['What should I do after a car accident?', 'Check that everyone is safe and call emergency services if needed. Exchange contact and insurance details, document the scene when safe, and keep copies of reports and medical records. Our team can help you understand common next steps.'],
  ['How much does claim support cost?', 'There is no upfront fee to submit an intake or speak with our team. We explain any applicable costs before you decide how to proceed.'],
  ['Do I need a police report to start?', 'You can start an intake without a police report. If one is available, keep a copy; if not, our team can explain how to request or document relevant information.'],
  ['How can I check my claim status?', 'Use the Claim ID provided after your intake along with the email address or phone number you submitted.'],
  ['Is The Collision Justice a law firm?', 'No. The Collision Justice is a legal marketing service and is not a law firm. Submitting information does not create an attorney-client relationship.'],
  ['How is my information used?', 'We use your information to review and respond to your request, provide claim-support information, and contact you as described in our Privacy Policy and the consent shown on the intake form.'],
] as const;