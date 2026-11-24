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
    type: z.enum(["Casa", "Apartamento", "Terreno", "Galpão"]),
    operation: z.enum(["Venda", "Aluguel"]),
    neighborhood: z.string(),
    city: z.string().default("Alto Araguaia"),
    state: z.string().default("MT"),
    price: z.number().positive(),
    priceSuffix: z.string().default(""),
    bedrooms: z.number().int().nonnegative().default(0),
    bathrooms: z.number().int().nonnegative().default(0),
    area: z.number().nonnegative().default(0),
    garage: z.number().int().nonnegative().default(0),
    images: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    /** true = anúncio ilustrativo; nunca deve ser publicado como oferta real. */
    sample: z.boolean().default(true),
    summary: z.string(),
  }),
});

export const collections = { pages, properties };
