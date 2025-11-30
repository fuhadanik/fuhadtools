import { SalesforceClient } from '@/lib/salesforce';
import { setSessionCookie, clearSessionCookie } from '@/lib/session';
import { requireAuth, withErrorHandling, compose } from '@/lib/apiMiddleware';

/**
 * POST /api/login
 * Validates Salesforce SID and creates session
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { instanceUrl, sid } = req.body;

  // Validate input
  if (!instanceUrl || !sid) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'instanceUrl and sid are required',
    });
  }

  // Validate instance URL format
  if (!instanceUrl.startsWith('https://')) {
    return res.status(400).json({
      error: 'Invalid instance URL',
      message: 'Instance URL must start with https://',
    });
  }

  try {
    // Create Salesforce client
    const sfClient = new SalesforceClient(instanceUrl, sid);

    // Validate the SID by making a test API call
    const isValid = await sfClient.validateSession();

    if (!isValid) {
      clearSessionCookie(res);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'The provided Session ID is invalid or expired',
      });
    }

    // Store session data in encrypted cookie
    setSessionCookie(res, {
      instanceUrl,
      sid,
    });

    return res.status(200).json({
      ok: true,
      message: 'Session created successfully',
    });

  } catch (error) {
    clearSessionCookie(res);
    console.error('Login error:', error);

    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}

// Apply middleware: require auth and error handling
export default compose(requireAuth, withErrorHandling)(handler);
