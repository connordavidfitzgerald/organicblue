import { defineType, defineField, defineArrayMember } from 'sanity'

// One archive collection = a titled group of images shown as its own page,
// with a cover used on the archive index + navbar. Editors drag the `images`
// array to control grid order.
export const archiveCollection = defineType({
  name: 'archiveCollection',
  title: 'Archive Collection',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Order',
      description: 'Controls left-to-right order on the archive index + navbar.',
      type: 'number',
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      description: 'Shown as this collection’s column on the archive index.',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'images',
      title: 'Images',
      description: 'The grid for this collection. Drag to reorder.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({
              name: 'alt',
              title: 'Alternative text',
              type: 'string',
            }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: { title: 'title', order: 'order', media: 'coverImage' },
    prepare({ title, order, media }) {
      return {
        title,
        subtitle: order != null ? `Order: ${order}` : undefined,
        media,
      }
    },
  },
})
