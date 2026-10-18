import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { iglooPageHtml } from './src/content/igloo-schema.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'igloo-page-metadata',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset' || typeof index.source !== 'string') {
        this.error('The igloo metadata build requires index.html')
      }
      this.emitFile({ type: 'asset', fileName: 'igloos/index.html', source: iglooPageHtml(index.source) })
    },
  }],
  server: { proxy: { '/api/igloo': process.env.IGLOO_API_PROXY || 'http://127.0.0.1:4317' } },
})
