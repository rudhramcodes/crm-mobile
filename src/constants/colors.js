// DESIGN.md colour tokens, the single source. Plain CommonJS so tailwind.config.js can load it too
// (it turns these into CSS variables, so `bg-surface` switches with the system theme).
const colors = {
  light: {
    bg: '#f6f1e0', surface: '#fffcf3', 'surface-2': '#efe6d0', ink: '#3b2515', muted: '#7a6552',
    line: '#e3d6bb', accent: '#b47737', 'accent-ink': '#8a5524', danger: '#b3412e', success: '#456b33',
  },
  dark: {
    bg: '#1c120b', surface: '#2a1a0f', 'surface-2': '#3b2515', ink: '#f6f1e0', muted: '#a8957f',
    line: '#3d2a1c', accent: '#c98d4e', 'accent-ink': '#d29a5e', danger: '#e07a63', success: '#8fb878',
  },
};

// Fixed brand colours from the kit; the same in both themes.
const brand = { ochre: '#b47737', beige: '#f6f1e0', brown: '#3b2515', sand: '#dcc19d' };

module.exports = { colors, brand };
