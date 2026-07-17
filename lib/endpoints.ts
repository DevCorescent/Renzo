// All API endpoint paths in one place.
// Frontend uses these constants — never hardcode strings in components.

const BASE = "/api/v1";

export const API = {
  upload: `${BASE}/upload`,

  // ── Notification center (Gauransh) — any authenticated role ────────────────
  notifications: {
    list:        `${BASE}/notifications`,
    unreadCount: `${BASE}/notifications/unread-count`,
    readAll:     `${BASE}/notifications/read-all`,
    read:        (id: string) => `${BASE}/notifications/${id}`,
  },

  // ── Auth (Aman) ────────────────────────────────────────────────────────────
  auth: {
    login:        `${BASE}/auth/login`,
    google:       `${BASE}/auth/google`,
    otpSend:      `${BASE}/auth/otp/send`,
    otpVerify:    `${BASE}/auth/otp/verify`,
    logout:       `${BASE}/auth/logout`,
    me:           `${BASE}/auth/me`,
  },

  // ── Public (no auth) ───────────────────────────────────────────────────────
  public: {
    branches:     `${BASE}/public/branches`,
    branch:       (slug: string) => `${BASE}/public/branches/${slug}`,
    workers:      `${BASE}/public/workers`,
    worker:       (id: string)   => `${BASE}/public/workers/${id}`,
    workerReviews:(id: string)   => `${BASE}/public/workers/${id}/reviews`,
    services:     `${BASE}/public/services`,
    service:      (slug: string) => `${BASE}/public/services/${slug}`,
    packages:     `${BASE}/public/packages`,
    slots:        `${BASE}/public/slots`,
    offers:       `${BASE}/public/offers`,
  },

  // ── Customer portal (Gauransh + Shalmon) ──────────────────────────────────
  customer: {
    profile:      `${BASE}/customer/profile`,
    appointments: `${BASE}/customer/appointments`,
    appointment:  (id: string) => `${BASE}/customer/appointments/${id}`,
    reschedule:   (id: string) => `${BASE}/customer/appointments/${id}/reschedule`,
    cancel:       (id: string) => `${BASE}/customer/appointments/${id}/cancel`,
    wallet:       `${BASE}/customer/wallet`,
    walletTopup:  `${BASE}/customer/wallet/topup`,
    loyalty:      `${BASE}/customer/loyalty`,
    loyaltyRedeem:`${BASE}/customer/loyalty/redeem`,
    membership:   `${BASE}/customer/membership`,
    reviews:      `${BASE}/customer/reviews`,
    review:       (id: string) => `${BASE}/customer/reviews/${id}`,
    giftCards:    `${BASE}/customer/gift-cards`,
    giftCardShare: `${BASE}/customer/gift-cards/share`,
  },

  // ── Worker panel (Aman + Gauransh) ────────────────────────────────────────
  worker: {
    appointments: `${BASE}/worker/appointments`,
    appointment:  (id: string) => `${BASE}/worker/appointments/${id}`,
    start:        (id: string) => `${BASE}/worker/appointments/${id}/start`,
    complete:     (id: string) => `${BASE}/worker/appointments/${id}/complete`,
    reschedule:   (id: string) => `${BASE}/worker/appointments/${id}/reschedule`,
    attendance:   `${BASE}/worker/attendance`,
    leaves:       `${BASE}/worker/leaves`,
    leave:        (id: string) => `${BASE}/worker/leaves/${id}`,
    shifts:       `${BASE}/worker/shifts`,

    // Portfolio — professional identity (Gauransh)
    portfolio:            `${BASE}/worker/portfolio`,
    portfolioItem:        (id: string) => `${BASE}/worker/portfolio/${id}`,
    portfolioSummary:     `${BASE}/worker/portfolio/summary`,
    portfolioStatistics:  `${BASE}/worker/portfolio/statistics`,
    portfolioSkillRatings:`${BASE}/worker/portfolio/skill-ratings`,
    portfolioReviews:     `${BASE}/worker/portfolio/reviews`,

    // Portfolio change requests — approval workflow (Gauransh)
    portfolioRequests:    `${BASE}/worker/portfolio-requests`,
  },

  // ── Reception panel (Gauransh + Shalmon) ──────────────────────────────────
  reception: {
    appointments: `${BASE}/reception/appointments`,
    checkin:      (id: string) => `${BASE}/reception/appointments/${id}/checkin`,
    assign:       (id: string) => `${BASE}/reception/appointments/${id}/assign`,
    billing:      `${BASE}/reception/billing`,
    bill:         (id: string) => `${BASE}/reception/billing/${id}`,
    payment:      (id: string) => `${BASE}/reception/billing/${id}/payment`,
    applyCoupon:  (id: string) => `${BASE}/reception/billing/${id}/coupon`,
    applyGiftCard: (id: string) => `${BASE}/reception/billing/${id}/gift-card`,
  },

  // ── Admin — Branches & Workers (Aman) ─────────────────────────────────────
  admin: {
    branches:         `${BASE}/admin/branches`,
    branch:           (id: string) => `${BASE}/admin/branches/${id}`,
    branchTimings:    (id: string) => `${BASE}/admin/branches/${id}/timings`,
    branchHolidays:   (id: string) => `${BASE}/admin/branches/${id}/holidays`,
    branchSettings:   (id: string) => `${BASE}/admin/branches/${id}/settings`,
    settings:         `${BASE}/admin/settings`,
    branchStaff:      (id: string) => `${BASE}/admin/branches/${id}/staff`,
    // Admin — Staff / Admin Appointment (Shalmon)
    staff:            `${BASE}/admin/staff`,
    staffMember:      (id: string) => `${BASE}/admin/staff/${id}`,
    staffResetPwd:    (id: string) => `${BASE}/admin/staff/${id}/reset-password`,
    workers:          `${BASE}/admin/workers`,
    worker:           (id: string) => `${BASE}/admin/workers/${id}`,
    workerSetPassword:(id: string) => `${BASE}/admin/workers/${id}/set-password`,
    workerSkills:     (id: string) => `${BASE}/admin/workers/${id}/skills`,
    workerServices:   (id: string) => `${BASE}/admin/workers/${id}/services`,
    workerPortfolio:  (id: string) => `${BASE}/admin/workers/${id}/portfolio`,
    workerAvailability:(id: string)=> `${BASE}/admin/workers/${id}/availability`,
    departments:      `${BASE}/admin/departments`,
    designations:     `${BASE}/admin/designations`,

    // Admin — Leave Types / HR config (Gauransh)
    leaveTypes:       `${BASE}/admin/leave-types`,
    leaveType:        (id: string) => `${BASE}/admin/leave-types/${id}`,

    // Admin — Leave requests / approvals (Gauransh)
    leaves:           `${BASE}/admin/leaves`,
    leavesStats:      `${BASE}/admin/leaves/stats`,
    leavesBalance:    `${BASE}/admin/leaves/balance`,
    leave:            (id: string) => `${BASE}/admin/leaves/${id}`,

    // Admin — Portfolio change requests / approvals (Gauransh)
    portfolioRequests:`${BASE}/admin/portfolio-requests`,
    portfolioRequest: (id: string) => `${BASE}/admin/portfolio-requests/${id}`,

    // Admin — Services (Gauransh)
    services:         `${BASE}/admin/services`,
    service:          (id: string) => `${BASE}/admin/services/${id}`,
    categories:       `${BASE}/admin/services/categories`,
    category:         (id: string) => `${BASE}/admin/services/categories/${id}`,
    serviceSubcategories: `${BASE}/admin/services/subcategories`,
    packages:         `${BASE}/admin/packages`,
    package:          (id: string) => `${BASE}/admin/packages/${id}`,
    addOns:           `${BASE}/admin/add-ons`,

    // Admin — Appointments (Gauransh)
    appointments:     `${BASE}/admin/appointments`,
    appointment:      (id: string) => `${BASE}/admin/appointments/${id}`,
    appointmentStatus:(id: string) => `${BASE}/admin/appointments/${id}/status`,
    appointmentAssign:(id: string) => `${BASE}/admin/appointments/${id}/assign`,

    // Admin — Billing (Shalmon)
    invoices:         `${BASE}/admin/invoices`,
    invoice:          (id: string) => `${BASE}/admin/invoices/${id}`,
    invoiceRefund:    (id: string) => `${BASE}/admin/invoices/${id}/refund`,

    // Admin — Inventory (Shalmon)
    products:         `${BASE}/admin/inventory/products`,
    product:          (id: string) => `${BASE}/admin/inventory/products/${id}`,
    stock:            `${BASE}/admin/inventory/stock`,
    stockAdjust:      `${BASE}/admin/inventory/stock/adjust`,
    stockMovements:   `${BASE}/admin/inventory/stock/movements`,
    purchases:        `${BASE}/admin/inventory/purchases`,
    purchase:         (id: string) => `${BASE}/admin/inventory/purchases/${id}`,
    transfers:        `${BASE}/admin/inventory/transfers`,
    transfer:         (id: string) => `${BASE}/admin/inventory/transfers/${id}`,
    suppliers:        `${BASE}/admin/inventory/suppliers`,
    supplier:         (id: string) => `${BASE}/admin/inventory/suppliers/${id}`,
    productCategories:`${BASE}/admin/inventory/categories`,
    productCategory:  (id: string) => `${BASE}/admin/inventory/categories/${id}`,

    // Admin — Memberships (Shalmon)
    membershipPlans:  `${BASE}/admin/memberships/plans`,
    membershipPlan:   (id: string) => `${BASE}/admin/memberships/plans/${id}`,
    membershipAnalytics: `${BASE}/admin/memberships/analytics`,
    membershipPlanCustomers: (id: string) => `${BASE}/admin/memberships/plans/${id}/customers`,

    // Admin — Marketing (Shalmon)
    coupons:          `${BASE}/admin/coupons`,
    coupon:           (id: string) => `${BASE}/admin/coupons/${id}`,
    couponAnalytics:  `${BASE}/admin/coupons/analytics`,
    campaigns:        `${BASE}/admin/campaigns`,
    campaign:         (id: string) => `${BASE}/admin/campaigns/${id}`,
    campaignAnalytics: `${BASE}/admin/campaigns/analytics`,
    offers:           `${BASE}/admin/offers`,
    offer:            (id: string) => `${BASE}/admin/offers/${id}`,
    giftCards:        `${BASE}/admin/gift-cards`,
    giftCard:         (id: string) => `${BASE}/admin/gift-cards/${id}`,
    giftCardAnalytics: `${BASE}/admin/gift-cards/analytics`,

    // Admin — Branch service pricing (Gauransh)
    branchServices:   `${BASE}/admin/branch-services`,

    // Admin — Reviews (Shalmon)
    reviews:          `${BASE}/admin/reviews`,
    reviewApprove:    (id: string) => `${BASE}/admin/reviews/${id}/approve`,
    reviewReject:     (id: string) => `${BASE}/admin/reviews/${id}/reject`,

    // Admin — Reports (Shalmon)
    revenueReport:    `${BASE}/admin/reports/revenue`,
    workerReport:     `${BASE}/admin/reports/workers`,
    inventoryReport:  `${BASE}/admin/reports/inventory`,
    appointmentReport:`${BASE}/admin/reports/appointments`,
  },
} as const;
