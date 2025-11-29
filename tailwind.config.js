/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'space-cadet': '#21295C',
        'jungle-green': '#21A179',
        'light-sea-green': '#20A39E',
        'green-yellow': '#BEEE62',
        'yale-blue': '#1B3B6F',
      },
      fontFamily: {
        'bebas': ['Bebas Neue', 'sans-serif'],
        'rubik': ['Rubik', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
