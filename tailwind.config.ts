import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // PubNub-inspired theme tokens for the sales engineering demo.
        pn: {
          navy: "#061B5A",
          navyDark: "#04113D",
          bg: "#F6F8FC",
          card: "#FFFFFF",
          border: "#DDE6F1",
          muted: "#5B6B84",
          text: "#0F172A",
          teal: "#0F6B7A",
          gold: "#FFD29A",
          goldDark: "#B86A00",
          purple: "#8B5CF6",
          red: "#D71920",
        },
      },
    },
  },
  plugins: [],
};

export default config;
