export const LightColors = {
  background: '#FAF8F4',
  card: '#FFFFFF',
  text: '#2B2B2B',
  muted: '#7A7A7A',
  primary: '#C9A24D',
  border: '#E6DED0',
  success: '#15803D',
  danger: '#B91C1C',
};

export const DarkColors = {
  background: '#0F0F10',
  card: '#151518',
  text: '#FFFFFF',
  muted: '#A1A1AA',
  primary: '#C9A24D',
  border: 'rgba(255,255,255,0.12)',
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
