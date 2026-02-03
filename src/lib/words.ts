export type WordPair = {
  common: string;
  undercover: string;
};

const WORD_POOL: WordPair[] = [
  { common: "Coffee", undercover: "Tea" },
  { common: "Beach", undercover: "Desert" },
  { common: "Cat", undercover: "Dog" },
  { common: "Pizza", undercover: "Burger" },
  { common: "Laptop", undercover: "Tablet" },
  { common: "Bicycle", undercover: "Motorcycle" },
  { common: "Movie", undercover: "Series" },
  { common: "Rain", undercover: "Snow" },
];

export function pickWordPair(): WordPair {
  const idx = Math.floor(Math.random() * WORD_POOL.length);
  return WORD_POOL[idx];
}
