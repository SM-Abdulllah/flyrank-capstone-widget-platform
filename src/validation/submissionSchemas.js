const { z } = require('zod');

const publicIdSchema = z.string().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/);

const submissionPayloadSchema = z
  .object({
    public_id: publicIdSchema.optional(),
    widget_id: publicIdSchema.optional(),
    idempotency_key: z.string().min(1).max(128).optional(),
    submitted_data: z.record(z.unknown()),
    website: z.string().max(256).optional().default('')
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.public_id && !value.widget_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['public_id'],
        message: 'public_id or widget_id is required'
      });
    }
  });

module.exports = {
  submissionPayloadSchema
};

