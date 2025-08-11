-- Production Database Migration - Complete HospedeFácil Schema
-- This migration creates all necessary tables for production

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE "UserRole" AS ENUM ('GUEST', 'HOST', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'CONDO', 'LOFT', 'STUDIO', 'FARM', 'CHALET', 'BOAT', 'VILLA', 'POUSADA', 'HOTEL', 'RESORT', 'OTHER');
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_REVIEW');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'IN_PROGRESS', 'NO_SHOW');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH');

-- Users table (main user table)
CREATE TABLE users (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'user_' || generate_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    phone VARCHAR(20),
    cpf VARCHAR(11) UNIQUE,
    cnpj VARCHAR(14) UNIQUE,
    date_of_birth DATE,
    role "UserRole" NOT NULL DEFAULT 'GUEST',
    status "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    document_verified BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Social login
    google_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    apple_id VARCHAR(255) UNIQUE,
    
    -- Profile info
    bio TEXT,
    languages TEXT[] DEFAULT ARRAY[]::TEXT[],
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    currency VARCHAR(3) DEFAULT 'BRL',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Host profiles
CREATE TABLE host_profiles (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'host_' || generate_random_uuid(),
    user_id VARCHAR(30) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Host verification
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    background_check BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Host stats
    total_bookings INTEGER NOT NULL DEFAULT 0,
    total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2),
    response_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    response_time INTEGER NOT NULL DEFAULT 0, -- in minutes
    
    -- Super Host
    is_super_host BOOLEAN NOT NULL DEFAULT FALSE,
    super_host_since TIMESTAMP WITH TIME ZONE,
    
    -- Bank info for payouts
    bank_account TEXT,
    pix_key TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest profiles
CREATE TABLE guest_profiles (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'guest_' || generate_random_uuid(),
    user_id VARCHAR(30) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Guest preferences
    smoking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    pets_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    children_friendly BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Travel style
    travel_purpose TEXT[] DEFAULT ARRAY[]::TEXT[],
    group_type VARCHAR(50) DEFAULT 'family',
    
    -- Guest stats
    total_bookings INTEGER NOT NULL DEFAULT 0,
    total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Addresses
CREATE TABLE addresses (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'addr_' || generate_random_uuid(),
    user_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    street TEXT NOT NULL,
    number VARCHAR(10),
    complement TEXT,
    neighborhood VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(9) NOT NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'BR',
    
    -- Coordinates for map display
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    -- Flags
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'prop_' || generate_random_uuid(),
    host_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic info
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type "PropertyType" NOT NULL,
    status "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    
    -- Location
    street TEXT NOT NULL,
    number VARCHAR(10),
    complement TEXT,
    neighborhood VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(9) NOT NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'BR',
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    
    -- Property details
    bedrooms INTEGER NOT NULL,
    bathrooms INTEGER NOT NULL,
    beds INTEGER NOT NULL,
    max_guests INTEGER NOT NULL,
    area DECIMAL(8,2), -- in square meters
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    cleaning_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Rules
    check_in_time VARCHAR(5) DEFAULT '15:00',
    check_out_time VARCHAR(5) DEFAULT '11:00',
    min_stay INTEGER NOT NULL DEFAULT 1,
    max_stay INTEGER NOT NULL DEFAULT 365,
    
    -- House rules
    smoking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    pets_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    parties_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Stats
    total_bookings INTEGER NOT NULL DEFAULT 0,
    total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2),
    review_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    
    -- SEO
    slug VARCHAR(255) UNIQUE,
    seo_title TEXT,
    seo_description TEXT,
    
    -- AI generated content
    ai_description TEXT,
    ai_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- Property images
CREATE TABLE property_images (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'img_' || generate_random_uuid(),
    property_id VARCHAR(30) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    url TEXT NOT NULL,
    alt TEXT,
    caption TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Amenities (master list)
CREATE TABLE amenities (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'amnt_' || generate_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property-Amenity relationship
CREATE TABLE property_amenities (
    property_id VARCHAR(30) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    amenity_id VARCHAR(30) NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    
    PRIMARY KEY (property_id, amenity_id)
);

-- Property availability calendar
CREATE TABLE property_availability (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'avail_' || generate_random_uuid(),
    property_id VARCHAR(30) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    price DECIMAL(10,2), -- Custom price for this date
    min_stay INTEGER,
    
    UNIQUE(property_id, date)
);

-- Bookings
CREATE TABLE bookings (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'book_' || generate_random_uuid(),
    property_id VARCHAR(30) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Booking details
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INTEGER NOT NULL,
    nights INTEGER NOT NULL,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    cleaning_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    taxes DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Status
    status "BookingStatus" NOT NULL DEFAULT 'PENDING',
    
    -- Guest info (denormalized for performance)
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(20),
    
    -- Special requests
    message TEXT,
    
    -- Check-in/out
    check_in_code VARCHAR(10),
    actual_check_in TIMESTAMP WITH TIME ZONE,
    actual_check_out TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Payments
CREATE TABLE payments (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'pay_' || generate_random_uuid(),
    booking_id VARCHAR(30) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    method "PaymentMethod" NOT NULL,
    status "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    
    -- PIX specific
    pix_key TEXT,
    qr_code TEXT,
    pix_id VARCHAR(255),
    
    -- Card specific
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),
    
    -- External IDs
    external_id VARCHAR(255),
    gateway_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB,
    
    -- Audit
    processed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'rev_' || generate_random_uuid(),
    booking_id VARCHAR(30) REFERENCES bookings(id) ON DELETE CASCADE,
    property_id VARCHAR(30) REFERENCES properties(id) ON DELETE CASCADE,
    author_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT NOT NULL,
    
    -- Detailed ratings
    cleanliness INTEGER CHECK (cleanliness >= 1 AND cleanliness <= 5),
    accuracy INTEGER CHECK (accuracy >= 1 AND accuracy <= 5),
    check_in INTEGER CHECK (check_in >= 1 AND check_in <= 5),
    communication INTEGER CHECK (communication >= 1 AND communication <= 5),
    location INTEGER CHECK (location >= 1 AND location <= 5),
    value INTEGER CHECK (value >= 1 AND value <= 5),
    
    -- Flags
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_reported BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- AI analysis
    sentiment VARCHAR(20), -- positive, negative, neutral
    ai_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review responses
CREATE TABLE review_responses (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'resp_' || generate_random_uuid(),
    review_id VARCHAR(30) NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    author_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages (between hosts and guests)
CREATE TABLE messages (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'msg_' || generate_random_uuid(),
    booking_id VARCHAR(30) REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Message type
    type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, image, system
    
    -- Attachments
    attachments TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorite properties
CREATE TABLE favorite_properties (
    user_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id VARCHAR(30) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (user_id, property_id)
);

-- Notifications
CREATE TABLE notifications (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'notif_' || generate_random_uuid(),
    user_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(100) NOT NULL, -- booking_confirmed, payment_received, etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings
CREATE TABLE settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'string', -- string, number, boolean, json
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events
CREATE TABLE analytics (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'event_' || generate_random_uuid(),
    event VARCHAR(100) NOT NULL, -- page_view, property_view, booking_attempt, etc.
    user_id VARCHAR(30),
    session_id VARCHAR(100),
    
    data JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search logs
CREATE TABLE search_logs (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'search_' || generate_random_uuid(),
    user_id VARCHAR(30),
    session_id VARCHAR(100) NOT NULL,
    
    -- Search details
    query TEXT NOT NULL,
    filters JSONB NOT NULL,
    results_count INTEGER NOT NULL,
    
    -- User interaction
    clicked_results TEXT[] DEFAULT ARRAY[]::TEXT[],
    booking_made BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Location
    user_city VARCHAR(255),
    user_state VARCHAR(2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dynamic pricing rules
CREATE TABLE pricing_rules (
    id VARCHAR(30) PRIMARY KEY DEFAULT 'price_' || generate_random_uuid(),
    property_id VARCHAR(30) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Rule configuration
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Conditions
    date_start DATE,
    date_end DATE,
    days_of_week INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- 0=Sunday, 6=Saturday
    min_days INTEGER,
    max_days INTEGER,
    
    -- Pricing adjustments
    adjustment_type VARCHAR(20) NOT NULL, -- percentage, fixed, multiplier
    adjustment_value DECIMAL(10,4) NOT NULL,
    
    -- Events/seasons
    event_name VARCHAR(255),
    season_type VARCHAR(20), -- high, low, peak
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_properties_host_id ON properties(host_id);
CREATE INDEX idx_properties_city_state ON properties(city, state);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_coordinates ON properties(latitude, longitude);
CREATE INDEX idx_properties_price ON properties(base_price);
CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_reviews_property_id ON reviews(property_id);
CREATE INDEX idx_reviews_author_id ON reviews(author_id);
CREATE INDEX idx_property_availability_date ON property_availability(property_id, date);
CREATE INDEX idx_messages_booking_id ON messages(booking_id);
CREATE INDEX idx_analytics_event ON analytics(event);
CREATE INDEX idx_analytics_created_at ON analytics(created_at);
CREATE INDEX idx_search_logs_created_at ON search_logs(created_at);

-- Add triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_host_profiles_updated_at BEFORE UPDATE ON host_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_profiles_updated_at BEFORE UPDATE ON guest_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_review_responses_updated_at BEFORE UPDATE ON review_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial system settings
INSERT INTO settings (key, value, type) VALUES
('platform_name', 'HospedeFácil', 'string'),
('platform_email', 'contato@hospedefacil.com.br', 'string'),
('platform_phone', '+55 11 9 8765-4321', 'string'),
('commission_rate', '12.0', 'number'),
('min_booking_value', '50.0', 'number'),
('max_booking_days', '365', 'number'),
('enable_instant_booking', 'true', 'boolean'),
('enable_dynamic_pricing', 'true', 'boolean'),
('currency', 'BRL', 'string'),
('timezone', 'America/Sao_Paulo', 'string'),
('maintenance_mode', 'false', 'boolean');

-- Create admin user
INSERT INTO users (
    email, 
    password, 
    name, 
    role, 
    status, 
    email_verified,
    created_at
) VALUES (
    'admin@hospedefacil.com.br',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewNlmJtJ7l0Sg6mG', -- password: admin123
    'Administrador HospedeFácil',
    'ADMIN',
    'ACTIVE',
    true,
    NOW()
);