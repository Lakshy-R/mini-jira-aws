import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier;
try {
  verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
    tokenUse: 'id', // ID token contains custom attributes (role, teamId)
  });
  console.log('Cognito Verifier created successfully (ID token)');
} catch (error) {
  console.error('Error creating Cognito Verifier:', error.message);
}

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifier.verify(token);

    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload['custom:role'],
      teamId: payload['custom:teamId'],
    };

    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ error: 'Invalid token', details: err.message });
  }
};