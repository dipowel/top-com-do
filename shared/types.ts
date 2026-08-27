export interface RankingProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  whatsapp: string | null;
  city: string | null;
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
