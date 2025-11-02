// Shared form options and constants used across the application

export const BLOOD_TYPES = [
  { value: 'unknown', label: "I don't know" },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
] as const;

export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

export const MEMBER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
] as const;

export const AGE_CATEGORIES = [
  { value: 'child', label: 'Child (Under 18)' },
  { value: 'adult', label: 'Adult (18+)' },
] as const;

export const RELATIONSHIP_TYPES = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
] as const;

// Extract type-safe values
export type BloodType = typeof BLOOD_TYPES[number]['value'];
export type Gender = typeof GENDERS[number]['value'];
export type MemberStatus = typeof MEMBER_STATUS_OPTIONS[number]['value'];
export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];
export type AgeCategory = typeof AGE_CATEGORIES[number]['value'];
export type RelationshipType = typeof RELATIONSHIP_TYPES[number]['value'];
