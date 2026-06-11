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
  background: '#0D0D0E',
  card: '#161617',
  surface: '#1D1D1F',
  elevated: '#222224',
  text: '#F7F4EE',
  muted: '#A29D94',
  primary: '#D0A94F',
  primarySoft: '#352D1D',
  onPrimary: '#17130B',
  border: '#2D2D30',
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
