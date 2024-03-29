type QuoteOTD = {
  text: string;
  author: string;
  source: string;
};

const QUOTES_OF_THE_DAY: QuoteOTD[] = [
  {
    text: 'When you are in a hurry, go slowly.',
    author: 'Proverb',
    source: 'https://books.google.com/books?id=e90lBgAAQBAJ&pg=PA19&lpg=PA19',
  },
  {
    text: "What you are is what you have been. What you'll be is what you do now.",
    author: 'Gautama Buddha',
    source: 'http://www.goodreads.com/quotes/187753-what-you-are-is-what-you-have-been-what-you-ll',
  },
  {
    text: 'Showing up is 80 percent of life.',
    author: 'Woody Allen',
    source: 'http://quoteinvestigator.com/2013/06/10/showing-up/',
  },
  {
    text: 'The best way to predict the future is to invent it.',
    author: 'Alan Kay',
    source: 'http://www.quotery.com/the-best-way-to-predict-the-future-is-to-invent/',
  },
  {
    text: 'Honesty is the first chapter in the book of wisdom.',
    author: 'Thomas Jefferson',
    source: 'http://www.monticello.org/site/jefferson/honesty-first-chapter-book-wisdom-quotation',
  },
  {
    text: "Cutting corners in life, settling in life, is dangerous.  It's the road to mediocrity.",
    author: 'Joe Rogan',
    source: 'http://www.youtube.com/watch?v=4p3tN_iFHY0&t=1h52m25s',
  },
  {
    text: "Everyone you will ever meet knows something you don't.",
    author: 'Bill Nye',
    source: 'http://www.reddit.com/r/IAmA/comments/x9pq0/iam_bill_nye_the_science_guy_ama/c5kfxpb',
  },
  {
    text: 'Never allow someone to be your priority while allowing yourself to be their option.',
    author: 'Mark Twain',
    source:
      'http://www.goodreads.com/quotes/174533-never-allow-someone-to-be-your-priority-while-allowing-yourself',
  },
  {
    text: "Once you're in the game, you either play it well or opt out entirely; there's rare incentive for going your own way.",
    author: 'Jeremy Gordon',
    source: 'https://theoutline.com/post/4647/grimes-elon-musk-dating',
  },
  {
    text: 'In the beginning of a change the patriot is a scarce man, and brave, and hated and scorned. When his cause succeeds, the timid join him, for then it costs nothing to be a patriot.',
    author: 'Mark Twain',
    source: 'https://www.goodreads.com/quotes/549-in-the-beginning-of-a-change-the-patriot-is-a',
  },
  {
    text: 'Life begins at the end of your comfort zone.',
    author: 'Neale Donald Walsch',
    source: 'https://www.brainyquote.com/quotes/neale_donald_walsch_452086',
  },
  {
    text: 'Satisfaction lies in the effort, not in the attainment. Full effort is full victory.',
    author: 'Mahatma Gandhi',
    source:
      'https://www.goodreads.com/quotes/293847-satisfaction-lies-in-the-effort-not-in-the-attainment-full',
  },
  {
    text: 'Admit it. You aren\'t like them. You\'re not even close. You may occasionally dress yourself up as one of them, watch the same mindless television shows as they do, maybe even eat the same fast food sometimes. But it seems that the more you try to fit in, the more you feel like an outsider, watching the "normal people" as they go about their automatic existences. For every time you say club passwords like "Have a nice day" and "Weather\'s awful today, eh?", you yearn inside to say forbidden things like "Tell me something that makes you cry" or "What do you think deja vu is for?". Face it, you even want to talk to that girl in the elevator. But what if that girl in the elevator (and the balding man who walks past your cubicle at work) are thinking the same thing? Who knows what you might learn from taking a chance on conversation with a stranger? Everyone carries a piece of the puzzle. Nobody comes into your life by mere coincidence. Trust your instincts. Do the unexpected. Find the others.',
    author: 'Tim Leary',
    source: 'https://zenpencils.com/comic/leary/',
  },
  {
    text: 'Everybody is looking for the right person, and nobody is trying to be the right person.',
    author: 'faelsoss',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgmokr/',
  },
  {
    text: 'My mom was dying. A friend told me "you have your whole life to freak out about this-- don\'t do it in front of her. "',
    author: 'DiffidentDissident',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgnjw2/',
  },
  {
    text: "It's only embarrassing if you're embarrassed.",
    author: 'eyecebrakr',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgoj7k/',
  },
  {
    text: 'The person that you will spend the most time with in your life is yourself, so try to make yourself as interesting as possible.',
    author: 'PM_ME_WALLPAPERS',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clglngl/',
  },
  {
    text: 'We judge others by their actions and ourselves on our intentions.',
    author: 'Rex--Banner',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgl4p9/',
  },
  {
    text: 'You have to be comfortable with being uncomfortable',
    author: 'wearinsweats',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgkg8w/',
  },
  {
    text: "I'm not afraid of death. It's the stake one puts up in order to play the game of life.",
    author: 'Jean Girraudoux',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgjuvd/',
  },
  {
    text: 'Death is nothing to us, since when we are, death has not come, and when death has come, we are not.',
    author: 'Epicurus',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgqzga/',
  },
  {
    text: "Only people who don't work make no mistakes.",
    author: 'dershodan',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgrg6a/',
  },
  {
    text: "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
    author: 'LoveOfProfit',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgs112/',
  },
  {
    text: "The only time you should look in your neighbor's bowl is to make sure he has enough.",
    author: 'Louis CK',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgn9e1/',
  },
  {
    text: "\"I'm bored\" is a useless thing to say. I mean, you live in a great, big, vast world that you've seen none percent of. Even the inside of your own mind is endless; it goes on forever, inwardly, do you understand? The fact that you're alive is amazing, so you don't get to say \"I'm bored.\"",
    author: 'Louis CK',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgz3qh/',
  },
  {
    text: 'Do it to do it, not to have done it.',
    author: 'corneliusthedog',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgkxja/',
  },
  {
    text: 'I learned to give... not because I have too much. But because I know how it feels to have nothing.',
    author: 'yours_duly',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgjwwo/',
  },
  {
    text: 'You are not required to set yourself on fire to keep other people warm.',
    author: 'maeEast',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgl6sz/',
  },
  {
    text: 'A fool thinks himself to be a wise man, a wise man knows himself to be a fool.',
    author: 'TheYellowKingg',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgkocs/',
  },
  {
    text: 'Put your mind where your body is.',
    author: 'thisismyjam37',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgkvdz/',
  },
  {
    text: 'Is this the hill you want to die on?',
    author: 'Tanto63',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgklcl/',
  },
  {
    text: 'Sucking at something is the first step to being sorta good at something.',
    author: 'Adventure Time',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clgjgb0/',
  },
  {
    text: "Don't do what you want. Do what you don't want. Do what you're trained not to want. Do the things that scare you the most.",
    author: 'Chuck Palahniuk',
    source:
      'https://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/clglzbk/',
  },
  {
    text: 'Never give up on a dream just because of the time it will take to accomplish it. The time will pass anyway.',
    author: 'Earl Nightingale',
    source:
      'http://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/',
  },
  {
    text: 'Worrying is like a rocking chair, you go back and forth but never get anywhere.',
    author: 'FuckinEhRightsBud',
    source:
      'http://www.reddit.com/r/AskReddit/comments/2jzn0j/what_is_something_someone_said_that_forever/',
  },
  {
    text: 'I wonder how much of what weighs me down is not mine to carry.',
    author: 'Aditi',
    source: 'https://www.goodreads.com/quotes/3966082-i-wonder-how-much-of-what-weighs-me-down-is',
  },
  {
    text: 'Education is an admirable thing, but it is well to remember from time to time that nothing worth knowing can be taught.',
    author: 'Oscar Wilde',
    source: 'https://www.brainyquote.com/quotes/oscar_wilde_161644',
  },
  {
    text: 'Perfection is finally attained not when there is no longer anything to add but when there is no longer anything to take away.',
    author: 'Antoine de Saint-Exupery',
    source: 'https://www.brainyquote.com/quotes/antoine_de_saintexupery_401881',
  },
  {
    text: 'Content makes poor men rich; discontent makes rich men poor.',
    author: 'Benjamin Franklink',
    source: 'https://www.brainyquote.com/quotes/benjamin_franklin_382923',
  },
  {
    text: 'Marry, and you will regret it; don’t marry, you will also regret it; marry or don’t marry, you will regret it either way. Laugh at the world’s foolishness, you will regret it; weep over it, you will regret that too; laugh at the world’s foolishness or weep over it, you will regret both. Believe a woman, you will regret it; believe her not, you will also regret it… Hang yourself, you will regret it; do not hang yourself, and you will regret that too; hang yourself or don’t hang yourself, you’ll regret it either way; whether you hang yourself or do not hang yourself, you will regret both. This, gentlemen, is the essence of all philosophy.',
    author: 'Søren Kierkegaard',
    source:
      'https://www.goodreads.com/quotes/7141047-marry-and-you-will-regret-it-don-t-marry-you-will',
  },
  {
    text: "Let one not neglect one's own welfare for the sake of another, however great. Clearly understanding one's own welfare, let one be intent upon the good.",
    author: 'Buddha',
    source: 'https://accesstoinsight.org/tipitaka/kn/dhp/dhp.12.budd.html',
  },
  {
    text: 'Sleep is the best meditation.',
    author: 'Dalai Lama',
    source: 'https://www.brainyquote.com/quotes/dalai_lama_111631',
  },
  {
    text: 'Expect problems and eat them for breakfast',
    author: 'Alfred A. Montapert',
    source: 'https://www.brainyquote.com/quotes/alfred_a_montapert_109332',
  },
  {
    text: 'We are what we repeatedly do. Excellence, then is not an act but a habit.',
    author: 'Will Durant (paraphrase of Aristotle)',
    source:
      'http://blogs.umb.edu/quoteunquote/2012/05/08/its-a-much-more-effective-quotation-to-attribute-it-to-aristotle-rather-than-to-will-durant/',
  },
  {
    text: 'If your mother says she loves you, check it out.',
    author: 'journalist saying',
    source: 'https://archives.cjr.org/behind_the_news/if_your_mother_says_she_loves.php',
  },
  {
    text: 'Habits are at first cobwebs, then cables.',
    author: 'Spanish proverb',
    source: 'http://www.quotegarden.com/habits.html',
  },
  {
    text: 'The bad news is you’re falling through the air, nothing to hang on to, no parachute. The good news is there’s no ground.',
    author: 'Chögyam Trungpa Rinpoche',
    source: 'https://shambhala.org/1508590_726177477394949_2121616270_n-3/',
  },
  {
    text: 'Fear is a natural reaction to moving closer to the truth.',
    author: 'Pema Chödrön',
    source: 'https://shambhala.org/1511534_744508865561810_1152471461_n-2/',
  },
  {
    text: 'You can think of death bitterly or with resignation, as a tragic interruption of your life, and take every possible measure to postpone it. Or, more realistically, you can think of life as an interruption of an eternity of personal nonexistence, and seize it as a brief opportunity to observe and interact with the living, ever-surprising world around us.',
    author: 'Barbara Ehrenreich',
    source: 'https://www.nytimes.com/2018/08/18/opinion/life-is-short-thats-the-point.html',
  },
];

// pick a random element from the array
// (adapted from https://stackoverflow.com/a/7120353/)
function getRandomElement(quotes: QuoteOTD[]): QuoteOTD {
  const index = Math.floor(Math.random() * quotes.length);
  return quotes[index];
}

const quoteOTD = getRandomElement(QUOTES_OF_THE_DAY);

console.log(`"${quoteOTD.text}"`);
console.log(`  --${quoteOTD.author}`);
