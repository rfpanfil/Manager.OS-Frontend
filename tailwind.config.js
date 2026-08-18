// File: /LOOPOS/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        // Criamos uma classe chamada 'nunito'
        nunito: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class', // Habilita modo escuro se seu sistema usar
}