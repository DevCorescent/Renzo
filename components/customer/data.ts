// OWNER: Devanshi | Hardcoded customer-portal data (Phase 1).
// Phase 2: replace these with `fetch(API.customer.*)` calls.

export const CUSTOMER = {
  name: "Priya Sharma",
  email: "priya.sharma@example.com",
  phone: "+91 98765 43210",
  memberSince: "March 2022",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  address: "402, Palm Residency, Bandra West, Mumbai 400050",
  gender: "Female",
  dob: "1994-08-12",
};

export type BookingStatus =
  | "CONFIRMED"
  | "PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "CHECKED_IN";

export type Booking = {
  id: string;
  service: string;
  stylist: string;
  branch: string;
  date: string;
  time: string;
  duration: string;
  price: number;
  status: BookingStatus;
  image: string;
};

export const BOOKINGS: Booking[] = [
  {
    id: "bk-1042",
    service: "Hair Colour — Global",
    stylist: "Rohan Mehta",
    branch: "Renzo Bandra",
    date: "12 Jul 2026",
    time: "4:30 PM",
    duration: "90 min",
    price: 2499,
    status: "CONFIRMED",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bk-1039",
    service: "Haircut & Blow-dry",
    stylist: "Aisha Kapoor",
    branch: "Renzo Andheri",
    date: "18 Jul 2026",
    time: "11:00 AM",
    duration: "45 min",
    price: 899,
    status: "PENDING",
    image:
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bk-1021",
    service: "Keratin Treatment",
    stylist: "Neha Verma",
    branch: "Renzo Bandra",
    date: "28 Jun 2026",
    time: "2:00 PM",
    duration: "120 min",
    price: 3499,
    status: "COMPLETED",
    image:
      "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bk-1008",
    service: "Manicure & Pedicure",
    stylist: "Kabir Singh",
    branch: "Renzo Powai",
    date: "10 Jun 2026",
    time: "5:15 PM",
    duration: "60 min",
    price: 1199,
    status: "COMPLETED",
    image:
      "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "bk-0994",
    service: "Bridal Makeup Trial",
    stylist: "Neha Verma",
    branch: "Renzo Bandra",
    date: "22 May 2026",
    time: "10:00 AM",
    duration: "90 min",
    price: 2499,
    status: "CANCELLED",
    image:
      "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=400&q=80",
  },
];

export const WALLET = {
  balance: 1850,
  transactions: [
    { id: "w1", label: "Top-up via UPI", date: "05 Jul 2026", amount: 2000, type: "CREDIT" as const },
    { id: "w2", label: "Payment — Keratin Treatment", date: "28 Jun 2026", amount: 500, type: "DEBIT" as const },
    { id: "w3", label: "Cashback — Loyalty reward", date: "20 Jun 2026", amount: 150, type: "CREDIT" as const },
    { id: "w4", label: "Payment — Manicure & Pedicure", date: "10 Jun 2026", amount: 1199, type: "DEBIT" as const },
    { id: "w5", label: "Wallet top-up", date: "01 Jun 2026", amount: 1000, type: "CREDIT" as const },
  ],
};

export const LOYALTY = {
  points: 2340,
  tier: "Gold",
  nextTier: "Platinum",
  pointsToNext: 660,
  lifetime: 8120,
  history: [
    { id: "l1", label: "Earned — Keratin Treatment", date: "28 Jun 2026", points: 175, type: "EARN" as const },
    { id: "l2", label: "Redeemed — ₹200 discount", date: "24 Jun 2026", points: 400, type: "REDEEM" as const },
    { id: "l3", label: "Earned — Manicure & Pedicure", date: "10 Jun 2026", points: 60, type: "EARN" as const },
    { id: "l4", label: "Birthday bonus", date: "12 Aug 2025", points: 500, type: "EARN" as const },
  ],
};

export const MEMBERSHIP = {
  active: true,
  plan: "Renzo Elite",
  price: 4999,
  cycle: "year",
  renewsOn: "14 Mar 2027",
  benefits: [
    "20% off on all services",
    "2 complimentary haircuts every month",
    "Priority booking & dedicated stylist",
    "Free birthday spa session",
    "Exclusive member-only offers",
  ],
  plans: [
    { name: "Renzo Basic", price: 1499, cycle: "year", perks: ["10% off all services", "1 free haircut / month", "Birthday discount"] },
    { name: "Renzo Elite", price: 4999, cycle: "year", perks: ["20% off all services", "2 free haircuts / month", "Priority booking", "Free birthday spa"] },
    { name: "Renzo Luxe", price: 8999, cycle: "year", perks: ["30% off all services", "Unlimited haircuts", "Dedicated stylist", "Quarterly spa day", "Home service"] },
  ],
};

export type ReviewItem = {
  id: string;
  service: string;
  stylist: string;
  rating: number;
  date: string;
  text: string;
};

export const REVIEWS: ReviewItem[] = [
  {
    id: "rv-1",
    service: "Keratin Treatment",
    stylist: "Neha Verma",
    rating: 5,
    date: "29 Jun 2026",
    text: "Absolutely loved the result — my hair feels silky and frizz-free. Neha was so thorough and gentle.",
  },
  {
    id: "rv-2",
    service: "Manicure & Pedicure",
    stylist: "Kabir Singh",
    rating: 4,
    date: "11 Jun 2026",
    text: "Relaxing session and neat work. Wait time was a little long but the finish was worth it.",
  },
];

export type GiftCardStatus = "ACTIVE" | "REDEEMED" | "EXPIRED";

export const GIFT_CARDS = [
  { id: "gc-1", code: "RENZO-GLOW-2499", value: 2499, balance: 2499, status: "ACTIVE" as GiftCardStatus, expiry: "31 Dec 2026", from: "Anjali (birthday gift)" },
  { id: "gc-2", code: "RENZO-CARE-1000", value: 1000, balance: 350, status: "ACTIVE" as GiftCardStatus, expiry: "30 Sep 2026", from: "Self-purchase" },
  { id: "gc-3", code: "RENZO-FEST-1500", value: 1500, balance: 0, status: "REDEEMED" as GiftCardStatus, expiry: "15 Apr 2026", from: "Rahul (festival gift)" },
];

export const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;
