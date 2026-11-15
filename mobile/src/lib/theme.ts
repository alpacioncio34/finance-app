import { useColorScheme } from 'react-native';

/**
 * Colour roles. Screens never hard-code colours: they read these through useTheme().
 *
 * Two colours carry meaning beyond decoration:
 * - `accent` (pine) is the app's own colour: actions, and anything you entered by hand.
 * - `bank` (blue) marks everything that comes from a connected bank and is read-only.
 */
const palette = {
  light: {
    bg: '#F2F4F1', // cool paper
    card: '#FFFFFF',
    text: '#14201B', // ink
    muted: '#66716B',
    border: '#DDE3DD',
    accent: '#0F5A45', // pine
    accentSoft: '#DDEBE4',
    onAccent: '#FFFFFF',
    income: '#17804F',
    expense: '#BF2F49',
    expenseSoft: '#F9E1E5',
    warn: '#A86A0B',
    warnSoft: '#FBEFD5',
    track: '#E4E9E4',
    // The dark summary panel at the top of each tab
    panel: '#12261F',
    onPanel: '#F4F7F4',
    onPanelMuted: '#A9B8B0',
    panelTrack: '#2C4239',
    panelAccent: '#8FE3B8',
    panelWarn: '#FFB3BF',
    bank: '#2747B8',
    bankSoft: '#E1E7FA',
    shadow: '#14201B',
  },
  dark: {
    bg: '#0D1311',
    card: '#161D1A',
    text: '#E9EDEA',
    muted: '#93A099',
    border: '#27312C',
    accent: '#79D6AA',
    accentSoft: '#1C3229',
    onAccent: '#0B1511',
    income: '#6FD19A',
    expense: '#FF8496',
    expenseSoft: '#3A1D24',
    warn: '#E8B64C',
    warnSoft: '#3A2E14',
    track: '#232C28',
    panel: '#1A2A24',
    onPanel: '#F4F7F4',
    onPanelMuted: '#A9B8B0',
    panelTrack: '#33483F',
    panelAccent: '#8FE3B8',
    panelWarn: '#FFB3BF',
    bank: '#9DB2FF',
    bankSoft: '#1D2647',
    shadow: '#000000',
  },
};

export type Theme = typeof palette.light;

/** Soft elevation for floating elements. */
export const elevation = (color: string, strength = 1) => ({
  shadowColor: color,
  shadowOpacity: 0.1 * strength,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3 * strength,
});

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

/** One radius per role, so shapes carry meaning. */
export const radius = { chip: 999, control: 14, card: 20, panel: 28, fab: 28 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semi: 'InstrumentSans_600SemiBold',
};
