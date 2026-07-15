// OWNER: Gauransh | DATA: Homepage content (Phase 1, hardcoded — no API on the homepage)
// Centralised so every home section component reads from one typed source.
import {
  Scissors,
  Droplets,
  Flower2,
  Brush,
  Wand2,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

export interface Service {
  icon: LucideIcon;
  name: string;
  desc: string;
  price: string;
  img: string;
  featured?: boolean;
}

export interface Benefit {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface PricingTier {
  icon: LucideIcon;
  name: string;
  items: { label: string; price: string }[];
  monthly: string;
  featured?: boolean;
}

export interface BlogPost {
  img: string;
  tag: string;
  date: string;
  title: string;
}

export interface Stylist {
  name: string;
  role: string;
  img: string;
}

export interface Testimonial {
  name: string;
  role: string;
  text: string;
  rating: number;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Stat {
  value: number;
  suffix: string;
  label: string;
}

export interface Package {
  name: string;
  price: string;
  cadence: string;
  desc: string;
  perks: string[];
  featured: boolean;
}

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=800&q=80";

export const STATS: Stat[] = [
  { value: 15, suffix: "k+", label: "Happy clients" },
  { value: 12, suffix: "+", label: "Years of expertise" },
  { value: 40, suffix: "+", label: "Expert stylists" },
  { value: 6, suffix: "", label: "Branches citywide" },
];

export const SERVICES: Service[] = [
  { icon: Scissors, name: "Haircut & Styling", desc: "Precision cuts and blow-dry finishes tailored to your face and hair type.", price: "from ₹499", img: "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=600&q=80", featured: true },
  { icon: Droplets, name: "Hair Colour", desc: "Global colour, highlights and balayage using ammonia-free premium brands.", price: "from ₹1,999", img: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=600&q=80" },
  { icon: Flower2, name: "Spa & Treatments", desc: "Deep-conditioning, keratin and scalp therapies for healthier hair.", price: "from ₹1,299", img: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=600&q=80" },
  { icon: Brush, name: "Makeup & Bridal", desc: "Party, HD and bridal makeup by senior artists for your big moments.", price: "from ₹2,499", img: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=600&q=80" },
  { icon: Wand2, name: "Smoothening", desc: "Frizz-free, salon-smooth hair with long-lasting nourishing formulas.", price: "from ₹3,499", img: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80" },
  { icon: Sparkles, name: "Nails & Grooming", desc: "Manicure, pedicure and grooming essentials in a relaxing setting.", price: "from ₹699", img: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=600&q=80" },
];

export const ABOUT_IMAGES: { src: string; alt: string }[] = [
  { src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80", alt: "Renzo salon interior with styling chairs" },
  { src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80", alt: "Client enjoying a treatment at Renzo" },
];

export const WHY_POINTS: string[] = [
  "Certified, continuously-trained stylists",
  "Premium, cruelty-free products",
  "Hygienic, sanitised tools every session",
  "Transparent pricing — no surprises",
];

export const STYLISTS: Stylist[] = [
  { name: "Aisha Kapoor", role: "Creative Director", img: "https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?auto=format&fit=crop&w=600&q=80" },
  { name: "Rohan Mehta", role: "Senior Colourist", img: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80" },
  { name: "Neha Verma", role: "Bridal Specialist", img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80" },
  { name: "Kabir Singh", role: "Style Consultant", img: "https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&w=600&q=80" },
];

export const GALLERY: { src: string; alt: string }[] = [
  { src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80", alt: "Fresh blow-dry and styling result at Renzo" },
  { src: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=500&q=80", alt: "Stylist colouring a client's hair" },
  { src: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=500&q=80", alt: "Relaxing salon treatment in progress" },
  { src: "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=500&q=80", alt: "Precision haircut being finished" },
  { src: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=500&q=80", alt: "Bridal makeup and hair styling" },
  { src: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=500&q=80", alt: "Modern Renzo salon interior" },
];

export const TESTIMONIALS: Testimonial[] = [
  { name: "Priya S.", role: "Colour client", text: "Best salon experience I've had in the city. My balayage came out exactly like the reference — I get compliments everywhere!", rating: 4.5 },
  { name: "Arjun M.", role: "Regular client", text: "Walked in for a quick trim and left with the sharpest cut of my life. The team genuinely knows their craft.", rating: 4.5 },
  { name: "Deepa R.", role: "Bridal client", text: "Booked the bridal package for my wedding. Professional, punctual and made me feel like a queen. Highly recommend.", rating: 4.5 },
];

export const PACKAGES: Package[] = [
  {
    name: "Silver",
    price: "₹1,499",
    cadence: "/ month",
    desc: "Everyday essentials to keep you looking sharp all month.",
    perks: ["2 haircuts / month", "1 express spa", "10% off products", "Priority booking"],
    featured: false,
  },
  {
    name: "Gold",
    price: "₹3,999",
    cadence: "/ month",
    desc: "Our most-loved plan — the complete grooming ritual.",
    perks: ["Unlimited haircuts", "2 spa treatments", "1 colour touch-up", "20% off all services", "Dedicated stylist"],
    featured: true,
  },
  {
    name: "Platinum",
    price: "₹7,999",
    cadence: "/ month",
    desc: "The full luxury experience with white-glove care.",
    perks: ["Everything in Gold", "Monthly bridal-grade session", "Home service add-on", "30% off all services", "Complimentary refreshments"],
    featured: false,
  },
];

export const FAQS: Faq[] = [
  { q: "Do I need to book in advance?", a: "Walk-ins are welcome, but we recommend booking online to guarantee your preferred stylist and time slot." },
  { q: "Which products do you use?", a: "We work with premium, cruelty-free professional brands and offer ammonia-free colour options across all branches." },
  { q: "Can I request a specific stylist?", a: "Absolutely. You can pick your favourite stylist during the booking flow, subject to their availability." },
  { q: "What is your cancellation policy?", a: "You can reschedule or cancel free of charge up to 4 hours before your appointment from your customer dashboard." },
];

// Repeated supporting line under each statistic (mirrors the reference).
export const STATS_BLURB =
  "At Renzo, we believe beauty is more than just a look — it's a feeling.";

export const BENEFITS: Benefit[] = [
  { icon: Scissors, title: "Expert Stylists", desc: "Our certified team stays on top of the latest trends to give you a look you'll love." },
  { icon: Sparkles, title: "Best Products", desc: "Only premium, cruelty-free professional products touch your hair and skin." },
  { icon: Star, title: "Best Service", desc: "Every visit is a consultation-led ritual, tailored end to end around you." },
];

export const PRICING_TIERS: PricingTier[] = [
  {
    icon: Sparkles,
    name: "Hair Care & Styling",
    items: [
      { label: "Haircut & Blowdry", price: "from ₹499" },
      { label: "Hair Colouring", price: "from ₹1,999" },
      { label: "Styling & Updos", price: "from ₹899" },
    ],
    monthly: "₹1,499",
  },
  {
    icon: Sparkles,
    name: "Colour & Highlights",
    items: [
      { label: "Global Colour", price: "from ₹1,999" },
      { label: "Balayage", price: "from ₹3,499" },
      { label: "Root Touch-up", price: "from ₹1,199" },
    ],
    monthly: "₹2,499",
    featured: true,
  },
  {
    icon: Sparkles,
    name: "Spa & Treatments",
    items: [
      { label: "Keratin Therapy", price: "from ₹3,499" },
      { label: "Scalp Detox", price: "from ₹1,299" },
      { label: "Deep Conditioning", price: "from ₹999" },
    ],
    monthly: "₹1,999",
  },
  {
    icon: Sparkles,
    name: "Bridal & Makeup",
    items: [
      { label: "HD Makeup", price: "from ₹2,499" },
      { label: "Bridal Package", price: "from ₹9,999" },
      { label: "Party Glam", price: "from ₹1,799" },
    ],
    monthly: "₹3,999",
  },
];

export const BLOG_POSTS: BlogPost[] = [
  { img: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=600&q=80", tag: "Trends", date: "Mar 12, 2026", title: "Simple everyday makeup tips for your skin" },
  { img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80", tag: "Trends", date: "Mar 12, 2026", title: "Skincare secrets for a lasting, healthy glow" },
  { img: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80", tag: "Trends", date: "Mar 12, 2026", title: "How to keep your hair healthy year-round" },
];

export const CONTACT_IMAGE =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";

export const CONTACT_INFO = {
  tagline: "Together, we craft confidence — honouring your look and celebrating new beginnings.",
  address: "12 Rosewood Avenue, Bandra West, Mumbai 400050",
  phone: "+91 98765 43210",
  email: "hello@renzo.salon",
};
