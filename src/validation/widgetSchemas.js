const { z } = require('zod');

const fieldNameSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Use letters, numbers, and underscores; start with a letter');

const fieldDefinitionSchema = z
  .object({
    name: fieldNameSchema,
    label: z.string().min(1).max(80),
    type: z.enum(['text', 'email', 'textarea']),
    required: z.boolean().default(false),
    maxLength: z.number().int().min(1).max(1000).default(255)
  })
  .strict();

const displayOptionsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'auto']).default('light'),
    placement: z.enum(['inline', 'bottom-right']).default('inline')
  })
  .strict()
  .default({
    theme: 'light',
    placement: 'inline'
  });

const widgetPayloadSchema = z
  .object({
    type: z.enum(['signup', 'contact', 'cta']),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).default(''),
    fields: z.array(fieldDefinitionSchema).min(1).max(10),
    button_text: z.string().trim().min(1).max(40),
    display_options: displayOptionsSchema
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set();
    for (const field of value.fields) {
      if (seen.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields'],
          message: `Duplicate field name: ${field.name}`
        });
      }
      seen.add(field.name);
    }
  });

const widgetIdParamSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();

module.exports = {
  widgetPayloadSchema,
  widgetIdParamSchema
};

