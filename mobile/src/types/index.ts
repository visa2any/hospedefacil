// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'GUEST' | 'HOST' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HostProfile {
  id: string;
  userId: string;
  identityVerified: boolean;
  backgroundCheck: boolean;
  isSuperHost: boolean;
  responseTime: number;
  responseRate: number;
  averageRating: number;
  totalBookings: number;
  totalEarnings: number;
  languages: string[];
  about?: string;
  user: User;
}

// Property Types
export interface Property {
  id: string;
  hostId: string;
  title: string;
  description: string;
  type: 'APARTMENT' | 'HOUSE' | 'ROOM' | 'STUDIO' | 'LOFT';
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'UNDER_REVIEW' | 'SUSPENDED';
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  basePrice: number;
  cleaningFee: number;
  serviceFee: number;
  taxRate: number;
  minStay: number;
  maxStay?: number;
  checkInTime: string;
  checkOutTime: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  totalEarnings: number;
  isInstantBook: boolean;
  cancellationPolicy: 'FLEXIBLE' | 'MODERATE' | 'STRICT';
  createdAt: string;
  updatedAt: string;
  host: HostProfile;
  images: PropertyImage[];
  amenities: Amenity[];
  reviews: Review[];
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  url: string;
  alt: string;
  order: number;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string;
  category: string;
  isHighlight: boolean;
}

// Booking Types
export interface Booking {
  id: string;
  propertyId: string;
  guestId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  totalPrice: number;
  basePrice: number;
  cleaningFee: number;
  serviceFee: number;
  taxAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'IN_PROGRESS';
  source: 'DIRECT' | 'WEBSITE' | 'MOBILE' | 'WHATSAPP';
  specialRequests?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  property: Property;
  guest: User;
  host: HostProfile;
  payments: Payment[];
  messages: Message[];
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: 'PIX' | 'CREDIT_CARD' | 'BANK_TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  pixKey?: string;
  pixQrCode?: string;
  createdAt: string;
  updatedAt: string;
}

// Review Types
export interface Review {
  id: string;
  propertyId: string;
  bookingId: string;
  authorId: string;
  rating: number;
  content: string;
  cleanliness: number;
  accuracy: number;
  checkIn: number;
  communication: number;
  location: number;
  value: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  author: User;
  responses: ReviewResponse[];
}

export interface ReviewResponse {
  id: string;
  reviewId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: User;
}

// Message Types
export interface Message {
  id: string;
  bookingId?: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'AUTOMATED' | 'WHATSAPP';
  readAt?: string;
  createdAt: string;
  sender: User;
  recipient: User;
}

// Search Types
export interface SearchFilters {
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  propertyType?: string[];
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  instantBook?: boolean;
  superHost?: boolean;
  rating?: number;
  sortBy?: 'PRICE_ASC' | 'PRICE_DESC' | 'RATING' | 'DISTANCE' | 'NEWEST';
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  properties: Property[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  facets: {
    priceRange: { min: number; max: number };
    propertyTypes: Array<{ type: string; count: number }>;
    amenities: Array<{ name: string; count: number }>;
  };
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

// Navigation Types
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  PropertyDetails: { propertyId: string };
  Booking: { propertyId: string; checkIn: string; checkOut: string; guests: number };
  BookingConfirmation: { bookingId: string };
  Payment: { bookingId: string };
  Messages: { bookingId?: string; userId?: string };
  Profile: undefined;
  EditProfile: undefined;
  Reviews: { propertyId?: string; userId?: string };
  WriteReview: { bookingId: string };
  Host: undefined;
  AddProperty: undefined;
  EditProperty: { propertyId: string };
  Calendar: { propertyId?: string };
  Analytics: { propertyId?: string };
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };
  VerifyPhone: { phone: string };
};

export type MainTabParamList = {
  Search: undefined;
  Trips: undefined;
  Messages: undefined;
  Profile: undefined;
  Host: undefined;
};

// Redux Store Types
export interface RootState {
  auth: AuthState;
  properties: PropertiesState;
  bookings: BookingsState;
  search: SearchState;
  messages: MessagesState;
  network: NetworkState;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface PropertiesState {
  favorites: string[];
  viewed: string[];
  cache: Record<string, Property>;
  isLoading: boolean;
  error: string | null;
}

export interface BookingsState {
  bookings: Booking[];
  currentBooking: Booking | null;
  isLoading: boolean;
  error: string | null;
}

export interface SearchState {
  filters: SearchFilters;
  results: Property[];
  suggestions: string[];
  recentSearches: SearchFilters[];
  isLoading: boolean;
  error: string | null;
}

export interface MessagesState {
  conversations: Array<{
    bookingId?: string;
    userId: string;
    user: User;
    lastMessage: Message;
    unreadCount: number;
  }>;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  error: string | null;
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

// Theme Types
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  text: string;
  textSecondary: string;
  border: string;
  divider: string;
}

export interface CustomTheme {
  colors: ThemeColors;
  fonts: {
    regular: string;
    medium: string;
    bold: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
}