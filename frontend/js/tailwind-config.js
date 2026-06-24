// tailwind-config.js
// Configuracion de Tailwind extendiendo la paleta de colores brand (verde)
// y warm (arena). Debe cargarse ANTES de cdn.tailwindcss.com para que el
// JIT de Tailwind tome la configuracion antes de generar las clases.
tailwind = {
  config: {
    theme: {
      extend: {
        colors: {
          brand: {
            50:  '#e6f5ef',
            100: '#c2e6d6',
            200: '#9ad7bd',
            300: '#6cc2a1',
            400: '#3dad85',
            500: '#1a8a66',
            600: '#0d6b4e',
            700: '#0a5a3f',
            800: '#073626',
            900: '#052b1d',
            950: '#031f14',
          },
          warm: {
            50:  '#fdf5ef',
            100: '#fae8d9',
            200: '#f5d4bd',
            300: '#efbf9a',
            400: '#e9aa78',
            500: '#DFAC85',
            600: '#c28f65',
            700: '#a0724b',
            800: '#7d5532',
            900: '#5a3b1f',
          },
        },
      },
    },
  },
};
