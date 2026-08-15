export interface LocationData {
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

export interface SegmentationData {
  baseCutPrice: number;
  acquisitionChannel: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string;
}

export interface ProfessionalItem {
  id: string;
  name: string;
  phone: string;
  commissionPercentage: number;
  isManager?: boolean;
}

export interface OnboardingState {
  currentStep: number;
  location: LocationData;
  segmentation: SegmentationData;
  services: ServiceItem[];
  professionals: ProfessionalItem[];
  planName: string;
  maxProfessionals: number;
}
