// Shared TypeScript interfaces for member-related data

import type { BloodType, Gender, MemberStatus } from '@/constants/formOptions';

export interface BaseMemberData {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  country_code?: string | null;
  date_of_birth: string;
  nationality: string;
  gender: Gender;
  blood_type?: BloodType | null;
  profile_image_url?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_country_code?: string | null;
}

export interface MemberData extends BaseMemberData {
  club_id: string;
  user_id?: string | null;
  status?: MemberStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ChildData extends BaseMemberData {
  parent_id: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
}

export interface ParentLookupResult {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  profile_image_url?: string | null;
}

export interface MembershipPackageData {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  description?: string | null;
  features?: string[] | null;
}

export interface MemberFormData extends BaseMemberData {
  package_id?: string;
  payment_method?: string;
  is_child?: boolean;
  parent_id?: string | null;
}

export interface ClubBasicInfo {
  id: string;
  name: string;
  location?: string | null;
  logo_url?: string | null;
}
