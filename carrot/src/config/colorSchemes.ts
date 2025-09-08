// Centralized color schemes for Composer and other components
// 40 vibrant gradient pairs, documented and extendable

export type ColorScheme = {
  name: string;
  gradientFromColor: string;
  gradientToColor: string;
  gradientViaColor?: string;
};

export const COLOR_SCHEMES: ColorScheme[] = [
  { name: 'Sunset Pop', gradientFromColor: '#FF7E5F', gradientToColor: '#FD3A69' },
  { name: 'Ocean Pop', gradientFromColor: '#36D1DC', gradientToColor: '#5B86E5' },
  { name: 'Mint Pop', gradientFromColor: '#84FAB0', gradientToColor: '#8FD3F4' },
  { name: 'Candy Grapefruit', gradientFromColor: '#F093FB', gradientToColor: '#F5576C' },
  { name: 'Amber Heat', gradientFromColor: '#F6D365', gradientToColor: '#FDA085' },
  { name: 'Purple Haze', gradientFromColor: '#A18CD1', gradientToColor: '#FBC2EB' },
  { name: 'Fresh Lime', gradientFromColor: '#A8E063', gradientToColor: '#56AB2F' },
  { name: 'Sky Surge', gradientFromColor: '#00C6FF', gradientToColor: '#0072FF' },
  { name: 'Pink Lemonade', gradientFromColor: '#FFDEE9', gradientToColor: '#B5FFFC' },
  { name: 'Flamingo', gradientFromColor: '#F7797D', gradientToColor: '#FBD786' },
  { name: 'Aurora', gradientFromColor: '#B7F8DB', gradientToColor: '#50A7C2' },
  { name: 'Peach Crush', gradientFromColor: '#FDB99B', gradientToColor: '#CF8BF3' },
  { name: 'Tropical', gradientFromColor: '#5EE7DF', gradientToColor: '#B490CA' },
  { name: 'Blue Raspberry', gradientFromColor: '#43C6AC', gradientToColor: '#191654' },
  { name: 'Hot Lava', gradientFromColor: '#F83600', gradientToColor: '#F9D423' },
  { name: 'Royal', gradientFromColor: '#8360C3', gradientToColor: '#2EBF91' },
  { name: 'Citrus', gradientFromColor: '#F9D423', gradientToColor: '#FF4E50' },
  { name: 'Cherry Soda', gradientFromColor: '#EB3349', gradientToColor: '#F45C43' },
  { name: 'Berry Burst', gradientFromColor: '#C33764', gradientToColor: '#1D2671' },
  { name: 'Bubblegum', gradientFromColor: '#FF9A9E', gradientToColor: '#FAD0C4' },
  { name: 'Mojito', gradientFromColor: '#1D976C', gradientToColor: '#93F9B9' },
  { name: 'Horizon', gradientFromColor: '#FCE38A', gradientToColor: '#F38181' },
  { name: 'Lagoon', gradientFromColor: '#43E97B', gradientToColor: '#38F9D7' },
  { name: 'Crush', gradientFromColor: '#FF512F', gradientToColor: '#DD2476' },
  { name: 'Coral Reef', gradientFromColor: '#FF9966', gradientToColor: '#FF5E62' },
  { name: 'Sunrise', gradientFromColor: '#FF512F', gradientToColor: '#F09819' },
  { name: 'Velvet', gradientFromColor: '#DA4453', gradientToColor: '#89216B' },
  { name: 'Neon Nights', gradientFromColor: '#12C2E9', gradientToColor: '#F64F59' },
  { name: 'Sonic', gradientFromColor: '#00DBDE', gradientToColor: '#FC00FF' },
  { name: 'Cobalt', gradientFromColor: '#00416A', gradientToColor: '#E4E5E6' },
  { name: 'Lollipop', gradientFromColor: '#A1FFCE', gradientToColor: '#FAFFD1' },
  { name: 'Gumdrop', gradientFromColor: '#FBD3E9', gradientToColor: '#BB377D' },
  { name: 'Sunblaze', gradientFromColor: '#F7971E', gradientToColor: '#FFD200' },
  { name: 'Cranberry', gradientFromColor: '#D31027', gradientToColor: '#EA384D' },
  { name: 'Atlantis', gradientFromColor: '#3A7BD5', gradientToColor: '#00D2FF' },
  { name: 'Peachy', gradientFromColor: '#FFD3A5', gradientToColor: '#FD6585' },
  { name: 'Violet Pop', gradientFromColor: '#DA22FF', gradientToColor: '#9733EE' },
  { name: 'Citrus Pop', gradientFromColor: '#FCE38A', gradientToColor: '#F38181' },
  { name: 'Minty Fresh', gradientFromColor: '#C6FFDD', gradientToColor: '#FBD786' },
  { name: 'Sunset Drive', gradientFromColor: '#F6D365', gradientToColor: '#FDA085' },
  { name: 'Electric', gradientFromColor: '#F8FF00', gradientToColor: '#3AD59F' },
];

export default COLOR_SCHEMES;
