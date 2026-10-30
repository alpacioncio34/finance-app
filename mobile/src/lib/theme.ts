import { useColorScheme } from 'react-native';

const palette = {
  light: {
    bg: '#f4f5f2',
    card: '#ffffff',
    text: '#14171a',
    muted: '#6b7278',
    border: '#e3e5e0',
    accent: '#1f6f5c', // deep green
    accentSoft: '#dcefe8',
    income: '#17804f',
    expense: '#c2412d',
    warn: '#c98a12',
    track: '#eceee9',
  },
  dark: {
    bg: '#0f1211',
    card: '#181c1b',
    text: '#eef1ef',
    muted: '#98a19d',
    border: '#272d2b',
    accent: '#5cc9a7',
    accentSoft: '#1d3a32',
    income: '#4ccf8c',
    expense: '#f07a65',
    warn: '#f0b54a',
    track: '#232927',
  },
};

export type Theme = typeof palette.light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

export const radius = { sm: 8, md: 14, lg: 20 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
