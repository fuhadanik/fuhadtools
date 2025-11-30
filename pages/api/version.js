// Debug endpoint to check deployment version
export default function handler(req, res) {
  const info = {
    timestamp: new Date().toISOString(),
    commitMessage: 'Fix layout fetching: Use Tooling API query for Layout object',
    apiVersion: 'v62.0',
    method: 'Tooling API',
    status: 'deployed'
  };

  return res.status(200).json(info);
}
