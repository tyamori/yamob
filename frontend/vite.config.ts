import { defineConfig, UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { InlineConfig } from 'vitest'

// Vitest の test プロパティを含む型を定義
interface VitestConfigExport extends UserConfig {
  test: InlineConfig
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 開発サーバーのポート設定 (例: 3000)
  server: {
    port: 3000,
    // バックエンドAPIへのプロキシ設定 (CORS対策として有効)
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        // secure: false, // 必要に応じて
        // rewrite: (path) => path.replace(/^\/api/, '') // パス書き換えが必要な場合
      },
      // WebSocket 用のプロキシ設定を追加
      '/socket.io': {
          target: 'ws://localhost:5001', // WebSocket プロトコルを指定
          ws: true, // WebSocket プロキシを有効にする
          changeOrigin: true, // オリジンを変更
      }
    }
  },
  // Vitest の設定を追加
  test: {
    globals: true, // describe, it などをグローバルにインポート不要にする
    environment: 'jsdom', // テスト環境として jsdom を使用
    setupFiles: './src/setupTests.ts', // テスト実行前に読み込むセットアップファイル (後で作成)
    // css: true, // CSS ファイルのインポートを扱う場合 (必要に応じて)
  },
} as VitestConfigExport) 