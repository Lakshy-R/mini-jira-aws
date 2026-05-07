import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier;
try {
  verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
    tokenUse: 'access',
  });
  console.log('Cognito Verifier created successfully');
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
    return res.status(401).json({ error: 'Invalid token' });
  }
};