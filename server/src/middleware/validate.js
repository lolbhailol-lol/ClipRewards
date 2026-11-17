/** Parses req.body with a zod schema; responds 400 with the first issue on failure. */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    return res.status(400).json({ error: field ? `${field}: ${issue.message}` : issue.message });
  }
  req.body = result.data;
  next();
};

module.exports = validate;
