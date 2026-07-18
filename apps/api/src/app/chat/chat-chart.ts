import type { ChatChart } from '@library-app/shared-models';
import { z } from 'zod';

export const RENDER_CHART_TOOL_NAME = 'render_chart';

export const renderChartFunctionDeclaration = {
  name: RENDER_CHART_TOOL_NAME,
  description:
    'Render an interactive chart in the chat. Use only data returned by application tools or explicitly supplied by the user. Aggregate raw records into clear, accurately labeled numeric series before calling this tool.',
  parametersJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'title', 'series'],
    properties: {
      kind: {
        type: 'string',
        enum: ['line', 'bar', 'area', 'pie'],
        description:
          'Use line or area for trends, bar for comparisons, and pie only for a small part-to-whole dataset.',
      },
      title: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 300 },
      xAxisLabel: { type: 'string', maxLength: 80 },
      yAxisLabel: { type: 'string', maxLength: 80 },
      series: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'data'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            data: {
              type: 'array',
              minItems: 1,
              maxItems: 200,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'value'],
                properties: {
                  label: { type: 'string', minLength: 1, maxLength: 100 },
                  value: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const chatChartSchema = z.object({
  kind: z.enum(['line', 'bar', 'area', 'pie']),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
  xAxisLabel: z.string().trim().max(80).optional(),
  yAxisLabel: z.string().trim().max(80).optional(),
  series: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        data: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(100),
              value: z.number().finite(),
            }),
          )
          .min(1)
          .max(200),
      }),
    )
    .min(1)
    .max(8),
});

export function parseChatChart(input: unknown): ChatChart {
  return chatChartSchema.parse(input);
}
