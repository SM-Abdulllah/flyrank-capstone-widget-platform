const { z } = require('zod');

const listSubmissionsQuerySchema = z
  .object({
    widget_id: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0)
  })
  .strict();

module.exports = {
  listSubmissionsQuerySchema
};

