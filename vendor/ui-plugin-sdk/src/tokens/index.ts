export const tokens = {
  color: {
    background: '#faf9f7',
    foreground: '#1c1917',
    primary: '#c2410c',
    primaryForeground: '#fff7ed',
    muted: '#e7e5e4',
    mutedForeground: '#57534e',
    border: '#d6d3d1',
    destructive: '#b91c1c',
    dark: {
      background: '#1c1917',
      foreground: '#fafaf9',
      primary: '#ea580c',
      primaryForeground: '#fff7ed',
      muted: '#292524',
      mutedForeground: '#a8a29e',
      border: '#44403c',
      destructive: '#ef4444',
    },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
  radius: { sm: '0.25rem', md: '0.5rem', lg: '0.75rem' },
  font: {
    family: 'ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
  },
} as const;

export type Tokens = typeof tokens;
export default tokens;
