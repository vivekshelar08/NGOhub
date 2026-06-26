export interface InspirationalQuote {
  quote: string;
  author: string;
  title: string;
  /** Optional background for hero slides */
  image?: string;
}

export const INSPIRATIONAL_QUOTES: InspirationalQuote[] = [
  {
    quote: "The best way to find yourself is to lose yourself in the service of others.",
    author: "Mahatma Gandhi",
    title: "Servant leadership",
    image: "/images/login-community.jpg",
  },
  {
    quote: "Overcoming poverty is not a gesture of charity. It is an act of justice.",
    author: "Nelson Mandela",
    title: "Justice & dignity",
    image: "/images/login-education.jpg",
  },
  {
    quote: "Not all of us can do great things. But we can do small things with great love.",
    author: "Mother Teresa",
    title: "Compassion in action",
    image: "/images/login-volunteers.jpg",
  },
  {
    quote: "Alone we can do so little; together we can do so much.",
    author: "Helen Keller",
    title: "Power of community",
    image: "/images/login-community.jpg",
  },
  {
    quote: "Life's most persistent and urgent question is: What are you doing for others?",
    author: "Martin Luther King Jr.",
    title: "Purpose-driven work",
    image: "/images/login-education.jpg",
  },
  {
    quote: "I slept and dreamt that life was joy. I awoke and saw that life was service.",
    author: "Rabindranath Tagore",
    title: "Joy through service",
    image: "/images/login-volunteers.jpg",
  },
];
