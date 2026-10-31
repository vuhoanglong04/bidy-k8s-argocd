/**
 * CORS configuration for HTTP and WebSocket connections
 * Enhanced configuration for better WebSocket connection reliability
 */

// Default allowed origins for development and production
const defaultOrigins = [
  'http://localhost:3000',     // Frontend dev server
  'http://127.0.0.1:3001',    // Alternative localhost
  process.env.CLIENT_URL,      // From environment
].filter(Boolean) as string[]; // Remove undefined values

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim())
  : defaultOrigins;

// HTTP CORS configuration with enhanced headers for rate limiting support
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // allow requests with no origin (like mobile apps, curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development allow all, or check against allowlist, local LAN IPs, and ngrok
    if (
      process.env.NODE_ENV === 'development' ||
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      /\.ngrok(-free)?\.(app|dev)$/.test(origin)
    ) {
      return callback(null, true);
    }
    
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  // Every verb the router actually mounts. A verb missing here fails as an opaque
  // browser-side "Network Error" — the preflight is refused, so the real request is
  // never sent and there is no response or status code to debug from.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],
};

let socketOrigin: string | string[] | boolean = ['http://localhost:3001'];
if (process.env.NODE_ENV === 'development') {
  socketOrigin = true;
} else if (allowedOrigins.length > 0) {
  socketOrigin = allowedOrigins;
}

// Enhanced Socket.io CORS configuration for better browser compatibility
export const socketCorsConfig = {
  origin: socketOrigin,
  credentials: true,
  methods: ['GET', 'POST'],
  allowEIO3: true, // Support older Engine.IO versions
  transports: ['websocket', 'polling'], // Explicit transport fallback
  upgrade: true,
  rememberUpgrade: false, // Don't remember transport for better Firefox compatibility
};

console.log('🌐[CORS]: HTTP origins configured:', process.env.NODE_ENV === 'development' ? 'all' : allowedOrigins);
console.log('🔌[CORS]: Socket.io origins configured:', socketCorsConfig.origin);
console.log('🔧[CORS]: Development mode:', process.env.NODE_ENV === 'development');