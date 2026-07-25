import { defineType, defineField } from 'sanity'

// One image on the explorations sphere (WebScene). `category` matches the exact
// lowercase values the explorations filter emits, so it drives the sphere's
// filtering directly.
export const explorationImage = defineType({
  name: 'explorationImage',
  title: 'Exploration Image',
  type: 'document',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Environment', value: 'environment' },
          { title: 'Product', value: 'product' },
          { title: 'Prototype', value: 'prototype' },
          { title: 'Research', value: 'research' },
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'featuredProduct',
      title: 'Featured product',
      description:
        'If this image features a shop product, a bar linking to it is shown beneath the image when zoomed in. Values match the shop product slugs.',
      type: 'string',
      options: {
        list: [
          { title: 'None', value: 'none' },
          { title: 'ES.RS', value: 'es-rs' },
          { title: 'ES.CAP', value: 'es-cap' },
          { title: 'ES.ST', value: 'es-st' },
        ],
        layout: 'radio',
      },
      initialValue: 'none',
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
    }),
  ],
  preview: {
    select: { category: 'category', media: 'image' },
    prepare({ category, media }) {
      return { title: category ?? 'Uncategorized', media }
    },
  },
})
