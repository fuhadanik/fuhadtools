/**
 * API Middleware utilities
 */

/**
 * Simple Firebase token validation (MVP version)
 * For production, use Firebase Admin SDK to verify tokens properly
 */
export function requireAuth(handler) {
  return async (req, res) => {
    // For MVP, we check if Authorization header exists
    // In production, verify the token with Firebase Admin SDK
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    // Extract token
    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // For MVP, we trust the client token if it exists
    // TODO: Implement Firebase Admin SDK verification for production
    req.firebaseToken = token;

    return handler(req, res);
  };
}

/**
 * Handle errors in API routes
 */
export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  };
}

/**
 * Compose multiple middleware functions
 */
export function compose(...middlewares) {
  return (handler) => {
    return middlewares.reduceRight(
      (wrapped, middleware) => middleware(wrapped),
      handler
    );
  };
}
