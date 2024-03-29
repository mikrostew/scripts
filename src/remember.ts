// things to remember, quotes I like

type Quote = {
  text: string;
  author: string;
};

const quotes: Quote[] = [
  // life
  {
    text: 'No one is coming to save you.',
    author: 'David Goggins',
  },
  {
    text: "Keep doing what you're doing, and you'll keep getting what you're getting.",
    author: 'Jeff Cavalier, athleanx.com',
  },
  {
    text: 'Do something that sucks every day.',
    author: 'David Goggins',
  },
  {
    text: 'If it scares you, then you have to do it.',
    author: 'dunno who said it',
  },
  {
    text: 'If you want to change yourself you have to challenge yourself.',
    author: 'Jeff Cavalier',
  },
  {
    text: "You're never going to feel like it.",
    author: 'Mel Robbins',
  },
  {
    text: 'Temporary means nothing. Lifetime is the only solution.',
    author: 'Jeff Cavalier',
  },
  {
    text: 'Sustainable progress isn’t about being consistently great; it’s about being great at being consistent. It’s about being good enough over and over again.',
    author: 'Outside Online',
  }, // https://www.outsideonline.com/2348226/case-being-good-enoug
  {
    text: 'The only limitation is in your mind.',
    author: 'dunno who said it',
  },
  {
    text: "You don't have a lack of resources. You have a lack of resourcefulness.",
    author: 'Tony Robbins',
  },
  {
    text: 'Lack of time is a lack of clear priorities.',
    author: 'dunno who said it',
  },
  {
    text: 'Someday is not a day of the week. There is no better time than starting right now.',
    author: 'Jeff Cavalier (paraphrased)',
  },
  // relationships
  {
    text: "It's better to be loving than right.",
    author: 'Jeff Weiner',
  },
  {
    text: "You're success is my success — we're in this together.",
    author: 'Simon Sinek',
  },
  {
    text: "We're social animals and we need each other.",
    author: 'Simon Sinek',
  },
];

// pick a random element from the array
function getRandomQuote(quotes: Quote[]): Quote {
  const index = Math.floor(Math.random() * quotes.length);
  return quotes[index];
}

const quote = getRandomQuote(quotes);

console.log('Remember');
console.log(`  "${quote.text}" (${quote.author})`);
