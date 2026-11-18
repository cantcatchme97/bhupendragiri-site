// Bhupendra Giri Productions: shoots from his portfolio (bhuppi687.myportfolio.com) and Instagram.
export const WHATSAPP = '917045113637';

// chapter: couture | menswear | editorial | personal
export const SHOOTS = [
  { slug: 'the-living-canvas', title: 'The Living Canvas', chapter: 'couture', year: 2026, line: 'A sitar, a lake and the last of the sun', n: 5 },
  { slug: 'white-symphony', title: 'White Symphony', chapter: 'couture', year: 2026, line: 'Ivory bridal couture and fine jewellery in the river mist', n: 12 },
  { slug: 'bougainvillea', title: 'Bougainvillea', chapter: 'couture', year: 2026, line: 'Rose silk in a wall of bougainvillea', n: 6 },
  { slug: 'river-song', title: 'River Song', chapter: 'couture', year: 2026, line: 'Rust, ivory and a paper fan on the river', n: 9 },
  { slug: 'the-garden-path', title: 'The Garden Path', chapter: 'couture', year: 2026, line: 'Sage florals on a quiet garden walk', n: 4 },
  { slug: 'elysian-queen', title: 'Elysian Queen', chapter: 'couture', year: 2026, line: 'Blush couture among the wild grass', n: 6 },
  { slug: 'indian-reverie', title: 'Indian Reverie', chapter: 'couture', year: 2026, line: 'Two sisters, emerald and indigo, by the water', n: 5 },
  { slug: 'the-bridal-veil', title: 'The Bridal Veil', chapter: 'couture', year: 2026, line: 'Red, gold and candlelight for Andaaz', client: 'Andaaz', n: 4 },
  { slug: 'the-weight-of-grace', title: 'The Weight of Grace', chapter: 'couture', year: 2026, line: 'A blush saree and a field of mustard flowers', n: 5 },
  { slug: 'indian-fashion', title: 'Indian Fashion', chapter: 'couture', year: 2026, line: 'Sage and silver in the morning haze', n: 6 },
  { slug: 'patriarchs', title: 'Patriarchs', chapter: 'menswear', year: 2026, line: 'Silver beards, sharp tailoring, no hurry', n: 12 },
  { slug: 'midnight-garden', title: 'Midnight Garden', chapter: 'menswear', year: 2026, line: 'Embroidered velvet against faded florals', n: 9 },
  { slug: 'the-language-of-form', title: 'The Language of Form', chapter: 'menswear', year: 2026, line: 'Menswear in motion, against studio blue', n: 8 },
  { slug: 'the-art-of-being', title: 'The Art of Being', chapter: 'menswear', year: 2026, line: 'Navy tailoring and a silver beard', n: 7 },
  { slug: 'the-art-of-luxury', title: 'The Art of Luxury', chapter: 'menswear', year: 2025, line: 'Black and white in the tall grass', n: 6 },
  { slug: 'rouge', title: 'Rouge', chapter: 'editorial', year: 2026, line: 'Red was the brief, for MUA Penny G Juneja', client: 'Penny G', n: 5 },
  { slug: 'forever-in-bloom', title: 'Forever in Bloom', chapter: 'editorial', year: 2025, line: 'Powder blue, wild curls, a lake at dawn', n: 5 },
  { slug: 'kutch', title: 'Kutch', chapter: 'off', year: 2023, line: 'Salt desert and the faces that live on it', n: 6 },
  { slug: 'rajasthan', title: 'Rajasthan', chapter: 'off', year: 2023, line: 'Lakes, cenotaphs and old stone', n: 6 },
  { slug: 'golden-temple', title: 'Golden Temple', chapter: 'off', year: 2023, line: 'Amritsar from first light to night', n: 5 },
];

export const CHAPTERS = [
  { id: 'couture', name: 'Couture & Bridal', no: 'I' },
  { id: 'menswear', name: 'Menswear & Characters', no: 'II' },
  { id: 'editorial', name: 'Editorial & Portraits', no: 'III' },
];

// pinned sets on the way in: two frames side by side, the shoot's name across the seam
export const SETS = [
  { slug: 'the-living-canvas', a: 4, b: 2 },
  { slug: 'white-symphony', a: 10, b: 8 },
  { slug: 'bougainvillea', a: 1, b: 4 },
  { slug: 'patriarchs', a: 2, b: 3 },
  { slug: 'river-song', a: 1, b: 4 },
];

export const shot = (slug, i, w = 1600) => `media/shoots/${slug}/${String(i).padStart(2, '0')}-${w}.webp`;
export const bySlug = (s) => SHOOTS.find(x => x.slug === s);
