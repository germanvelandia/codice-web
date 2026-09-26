/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Paleta institucional nueva — se redefinen los mismos nombres que
      // ya se usaban en toda la app ("violet", "amber"), así TODO el
      // código existente cambia de color solo, sin tocar archivo por
      // archivo. "violet" pasa a ser la escala Azul tinta/mariano/cielo,
      // y "amber" (que ya se usaba para monedas/XP/destacados) pasa a
      // ser la escala del Dorado.
      colors: {
        violet: {
          50: "#E8EEF8",  // Azul cielo
          100: "#ccd7eb",
          200: "#a7b8db",
          300: "#829aca",
          400: "#5474b5",
          500: "#2F55A4", // Azul mariano — color principal (botones, enlaces, pestañas activas)
          600: "#28478a",
          700: "#223b74",
          800: "#1c2f5e",
          900: "#17264D", // Azul tinta — menú lateral, encabezados, títulos
          950: "#0f1932",
        },
        amber: {
          50: "#f9f6ee",
          100: "#f1e7d5",
          200: "#e3d0aa",
          300: "#d4b880",
          400: "#c39b4b",
          500: "#B8892B", // Dorado — semestre completo, mensajes nuevos, rol "(tú)"
          600: "#9c7425",
          700: "#81601e",
          800: "#654b18",
          900: "#4a3711",
        },
        white: "#FBFBFD", // Blanco papel — fondo general de la plataforma
      },
      fontFamily: {
        // Se usan por CSS global en index.css (títulos en serif, cuerpo
        // en Figtree) — estas quedan disponibles además por si se
        // necesita una clase puntual (font-serif / font-sans).
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Figtree", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
