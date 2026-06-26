export interface InspirationalQuote {
  quote: string;
  author: string;
  title: string;
  /** Optional background for hero slides */
  image?: string;
  /** Accent gradient class fragment */
  accent: "saffron" | "emerald" | "sky" | "coral" | "violet";
}

export const INSPIRATIONAL_QUOTES: InspirationalQuote[] = [
  {
    quote: "The best way to find yourself is to lose yourself in the service of others.",
    author: "Mahatma Gandhi",
    title: "Servant leadership",
    image: "/images/login-community.jpg",
    accent: "emerald",
  },
  {
    quote: "Overcoming poverty is not a gesture of charity. It is an act of justice.",
    author: "Nelson Mandela",
    title: "Justice & dignity",
    image: "/images/login-education.jpg",
    accent: "coral",
  },
  {
    quote: "Not all of us can do great things. But we can do small things with great love.",
    author: "Mother Teresa",
    title: "Compassion in action",
    image: "/images/login-volunteers.jpg",
    accent: "saffron",
  },
  {
    quote: "Alone we can do so little; together we can do so much.",
    author: "Helen Keller",
    title: "Power of community",
    image: "/images/login-community.jpg",
    accent: "sky",
  },
  {
    quote: "Life's most persistent and urgent question is: What are you doing for others?",
    author: "Martin Luther King Jr.",
    title: "Purpose-driven work",
    image: "/images/login-education.jpg",
    accent: "violet",
  },
  {
    quote: "I slept and dreamt that life was joy. I awoke and saw that life was service.",
    author: "Rabindranath Tagore",
    title: "Joy through service",
    image: "/images/login-volunteers.jpg",
    accent: "emerald",
  },
];

export const ACCENT_GRADIENT: Record<InspirationalQuote["accent"], string> = {
  saffron: "from-brand-saffron to-brand-coral",
  emerald: "from-brand-emerald to-brand-teal",
  sky: "from-brand-sky to-brand-blue",
  coral: "from-brand-coral to-brand-red",
  violet: "from-brand-violet to-brand-blue",
};
