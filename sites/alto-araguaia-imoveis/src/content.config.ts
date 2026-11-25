import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro:schema";

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(0),
  }),
});

const properties = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/properties" }),
  schema: z.object({
    title: z.string(),
    code: z.string(),
    type: z.enum([
      "Casa",
      "Apartamento",
      "Sala comercial",
      "Área",
      "Chácara",
      "Fazenda",
    ]),
    category: z.enum(["urbano", "rural"]),
    operation: z.enum(["Venda", "Aluguel", "Venda e locação"]),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
    price: z.number().positive(),
    rentPrice: z.number().positive().optional(),
    area: z.number().positive(),
    areaUnit: z.enum(["m²", "ha"]).default("m²"),
    bedrooms: z.number().int().nonnegative().default(0),
    bathrooms: z.number().int().nonnegative().default(0),
    garage: z.number().int().nonnegative().default(0),
    images: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    /** `true` = dados migrados/de exemplo, ainda não validados comercialmente. */
    sample: z.boolean().default(false),
    summary: z.string(),
  }),
});

export const collections = { pages, properties };
