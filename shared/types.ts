export interface RankingProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  tagline: string | null;
  subcategory: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  province: string | null;
  provinceName: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  categorySlug: string;
  categoryName: string;
}

export interface RankingEntry {
  position: number;
  isChampion: boolean;
  totalDop: number;
  bidsCount: number;
  profile: RankingProfile;
}

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: 'user' | 'admin' | 'superadmin';
  referralCode: string | null;
  creditBalanceDop: number;
}

export interface SuggestedBid {
  minimum: number;
  current: number;
  next: number;
  scope: 'profile' | 'category' | 'province' | 'global';
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface BankAccountDTO {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string | null;
  currency: 'DOP' | 'USD';
  instructions: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface MyReferral {
  id: string;
  status: 'pending' | 'eligible' | 'approved' | 'rejected';
  bonusDop: number;
  referredEmail: string | null;
  referredName: string | null;
  createdAt: string;
  approvedAt: string | null;
}
