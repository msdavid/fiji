import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Arial', 'Helvetica', 'sans-serif'], // Use the CSS variable from globals.css
        mono: ['var(--font-mono)', 'monospace'], // Use the CSS variable from globals.css
      },
      // You can extend the default Tailwind theme here
      // For example, adding custom colors, fonts, etc.
      // colors: {
      //   'brand-primary': '#123456',
      // },
    },
  },
  plugins: [
    // You can add Tailwind plugins here
    // For example, require('@tailwindcss/forms')
  ],
} satisfies Config