import { useColorScheme } from 'react-native';

const palette = {
  light: {
    bg: '#F5EFE6', // sand
    card: '#FFFBF5',
    text: '#22302A', // deep green-black
    muted: '#7A8078',
    border: '#E3DACB',
    accent: '#2F6B4F', // forest
    accentSoft: '#DCEBE1',
    onAccent: '#FFFFFF',
    income: '#2F8A5B',
    expense: '#C4553A', // terracotta
    warn: '#B8860B',
    track: '#E8DFD0',
    hero: ['#1F5A41', '#2F8A5B', '#58B27F'] as const,
    onHero: '#FFFFFF',
    shadow: '#2F6B4F',
  },
  dark: {
    bg: '#141A17',
    card: '#1D2521',
    text: '#EDEBE3',
    muted: '#9AA39B',
    border: '#2B3631',
    accent: '#7CC49C',
    accentSoft: '#23382D',
    onAccent: '#0F1713',
    income: '#6FD19A',
    expense: '#F08A6C',
    warn: '#E5B84A',
    track: '#28322D',
    hero: ['#1B4A36', '#2A7A55', '#3E9C6E'] as const,
    onHero: '#FFFFFF',
    shadow: '#000000',
  },
};

export type Theme = Omit<typeof palette.light, 'hero'> & { hero: readonly [string, string, ...string[]] };

/** Soft elevation for cards and floating elements. */
export const elevation = (color: string, strength = 1) => ({
  shadowColor: color,
  shadowOpacity: 0.12 * strength,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3 * strength,
});

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

/** One radius per role, so shapes carry meaning. */
export const radius = { chip: 999, control: 16, card: 24, fab: 28 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semi: 'InstrumentSans_600SemiBold',
};
