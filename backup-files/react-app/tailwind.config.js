/** Tailwind for the shadcn/ui components. Preflight (the global reset) is off so App.css keeps working. */
const ui = (name) => `hsl(var(--ui-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: { sans: ['Raleway', 'system-ui', 'sans-serif'] },
      colors: {
        border: ui('border'), input: ui('input'), ring: ui('ring'), background: ui('background'), foreground: ui('foreground'),
        primary: { DEFAULT: ui('primary'), foreground: ui('primary-foreground') },
        secondary: { DEFAULT: ui('secondary'), foreground: ui('secondary-foreground') },
        destructive: { DEFAULT: ui('destructive'), foreground: ui('destructive-foreground') },
        muted: { DEFAULT: ui('muted'), foreground: ui('muted-foreground') },
        accent: { DEFAULT: ui('accent'), foreground: ui('accent-foreground') },
        popover: { DEFAULT: ui('popover'), foreground: ui('popover-foreground') },
        card: { DEFAULT: ui('card'), foreground: ui('card-foreground') },
        brand: ui('brand'), track: ui('track'),
        warn: { DEFAULT: ui('warn-bg'), line: ui('warn-line'), ink: ui('warn-ink') },
      },
      borderRadius: { lg: 'calc(var(--ui-radius) + 2px)', md: 'var(--ui-radius)', sm: 'calc(var(--ui-radius) - 2px)', xl: 'calc(var(--ui-radius) + 4px)' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: { 'accordion-down': 'accordion-down 0.2s ease-out', 'accordion-up': 'accordion-up 0.2s ease-out' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
