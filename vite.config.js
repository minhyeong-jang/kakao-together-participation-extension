import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'

// 크롬 익스텐션을 위한 커스텀 플러그인
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle() {
      // dist 폴더가 생성된 후에 실행
      const distDir = resolve(process.cwd(), 'dist')
      
      // dist 폴더 확인 및 생성
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true })
      }

      // manifest.json 복사
      const manifestSrc = resolve(process.cwd(), 'manifest.json')
      const manifestDest = resolve(distDir, 'manifest.json')
      copyFileSync(manifestSrc, manifestDest)

      // rules.json 복사
      const rulesSrc = resolve(process.cwd(), 'rules.json')
      const rulesDest = resolve(distDir, 'rules.json')
      copyFileSync(rulesSrc, rulesDest)

      // HTML 파일들을 루트로 이동
      const popupHtmlSrc = resolve(distDir, 'src/popup/popup.html')
      const optionsHtmlSrc = resolve(distDir, 'src/options/options.html')
      
      if (existsSync(popupHtmlSrc)) {
        copyFileSync(popupHtmlSrc, resolve(distDir, 'popup.html'))
      }
      if (existsSync(optionsHtmlSrc)) {
        copyFileSync(optionsHtmlSrc, resolve(distDir, 'options.html'))
      }

      // 불필요한 src 폴더 삭제
      const srcDir = resolve(distDir, 'src')
      if (existsSync(srcDir)) {
        rmSync(srcDir, { recursive: true, force: true })
      }

      // 아이콘 없이 실행 (필요시 나중에 추가)
      console.log('ℹ️  아이콘 파일 없이 실행 중 (기본 Chrome 아이콘 사용)')

      console.log('✓ 크롬 익스텐션 파일 복사 완료')
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    chromeExtensionPlugin()
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(process.cwd(), 'src/popup/popup.html'),
        options: resolve(process.cwd(), 'src/options/options.html'),
        background: resolve(process.cwd(), 'src/background/background.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // background.js는 그대로 유지
          if (chunkInfo.name === 'background') {
            return 'background.js'
          }
          return '[name].js'
        },
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return '[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2017',
    minify: 'esbuild'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})
