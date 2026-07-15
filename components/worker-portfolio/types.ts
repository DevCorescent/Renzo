// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — response types
//
// These mirror the worker portfolio API responses EXACTLY — nothing invented. A
// field absent from the backend is absent here, so the UI can never render a value
// the server did not send.
//   GET /api/v1/worker/portfolio/summary        → PortfolioSummary
//   GET /api/v1/worker/portfolio/statistics     → PortfolioStatistics
//   GET /api/v1/worker/portfolio/skill-ratings  → SkillRating[]
//   GET /api/v1/worker/portfolio                 → Paginated<GalleryItem>
//   GET /api/v1/worker/portfolio/reviews         → Paginated<PortfolioReview>
// ============================================================================

export type PortfolioSummary = {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  profilePhoto: string | null;
  experienceYears: number;
  joinDate: string;
  languages: string[];
  certificates: string[];
  specializations: { name: string; proficiency: number }[];
  averageRating: number;
  totalReviews: number;
};

export type PortfolioStatistics = {
  completedBookings: number;
  completedServices: number;
  repeatCustomers: number;
  serviceOfferings: number;
  averageRating: number;
  totalReviews: number;
  revenueGenerated: number;
  completionRate: number;
  cancellationRate: number;
  growthPercentage: number;
};

export type SkillRating = {
  serviceId: string;
  serviceName: string;
  averageRating: number;
  reviewCount: number;
};

export type GalleryItem = {
  id: string;
  category: string;
  title: string | null;
  description: string | null;
  beforeImage: string | null;
  afterImage: string;
  isApproved: boolean;
  sortOrder: number;
  createdAt: string;
};

export type PortfolioReview = {
  id: string;
  overallRating: number;
  serviceRating: number | null;
  comment: string | null;
  adminReply: string | null;
  createdAt: string;
  customer: { firstName: string };
  serviceName: string | null;
};
