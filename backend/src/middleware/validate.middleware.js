/**
 * Zod-based request validation middleware factory.
 * Usage: router.post('/', validate(MySchema), controller.create)
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }
  req.body = result.data; // replace with coerced/parsed data
  next();
};
