/** @type {import('next').NextConfig} */
const nextConfig = {
  // Clean Next.js configuration for stable build
  images: {
    domains: [
      'images.unsplash.com',
      'res.cloudinary.com',
      'hospedefacil-uploads.s3.amazonaws.com',
      'i.pravatar.cc'
    ],
    formats: ['image/webp', 'image/avif'],
  },
  // Remove problematic rewrites that may cause static file issues
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig