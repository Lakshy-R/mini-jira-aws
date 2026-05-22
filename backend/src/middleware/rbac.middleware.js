/**
 * Role-based access control middleware factory.
 * Always checks req.user exists first, then validates role.
 * Usage: router.post('/', requireRole('manager'), controller.create)
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }
  next();
};
