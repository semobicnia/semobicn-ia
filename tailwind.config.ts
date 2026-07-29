import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211b",
        forest: "#173f2b",
        leaf: "#2f6b49",
        mist: "#eef3ef",
        sand: "#e9ddc9",
      },
      boxShadow: {
        panel: "0 18px 60px rgba(23, 63, 43, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
