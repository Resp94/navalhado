export interface OnboardingLocation {
  country?: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface OnboardingSegmentation {
  baseCutPrice: number;
  acquisitionChannel: string;
}

export interface OnboardingService {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string;
}

export interface OnboardingProfessional {
  id: string;
  name: string;
  phone: string;
  commissionPercentage: number;
  isManager?: boolean;
}

export type LocationData = OnboardingLocation;
export type SegmentationData = OnboardingSegmentation;
export type ServiceItem = OnboardingService;
export type ProfessionalItem = OnboardingProfessional;

export interface OnboardingState {
  currentStep: number;
  location: OnboardingLocation;
  segmentation: OnboardingSegmentation;
  services: OnboardingService[];
  professionals: OnboardingProfessional[];
  planName: string;
  maxProfessionals: number;
}
