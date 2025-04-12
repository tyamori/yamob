/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html", // プロジェクトルートの index.html を追加
    "./src/**/*.{js,ts,jsx,tsx}", // src 以下のファイルを対象に
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 