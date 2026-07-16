export const LightColors = {
  background: '#F7F4EE',
  card: '#FFFCF7',
  surface: '#F0EBE2',
  elevated: '#FFFFFF',
  text: '#211E19',
  muted: '#756F66',
  primary: '#B58A32',
  primarySoft: '#EEE1C1',
  onPrimary: '#FFFFFF',
  border: '#E3DDD2',
  success: '#15803D',
  danger: '#B91C1C',
};

export const DarkColors = {
  background: '#1B1B1D',
  card: '#232326',
  surface: '#2A2A2E',
  elevated: '#303034',
  text: '#F4F1EB',
  muted: '#ABA7A0',
  primary: '#D0A94F',
  primarySoft: '#3B3322',
  onPrimary: '#17130B',
  border: '#3B3B40',
  success: '#4ADE80',
  danger: '#F87171',
};

const Colors = {
  light: {
    text: LightColors.text,
    background: LightColors.background,
    tint: LightColors.primary,
    tabIconDefault: LightColors.muted,
    tabIconSelected: LightColors.primary,
  },
  dark: {
    text: DarkColors.text,
    background: DarkColors.background,
    tint: DarkColors.primary,
    tabIconDefault: DarkColors.muted,
    tabIconSelected: DarkColors.primary,
  },
};

export default Colors;
