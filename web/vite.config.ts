import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pageMetadataHtml, publicPages, privatePages } from './src/content/page-metadata.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'public-page-metadata',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset' || typeof index.source !== 'string') {
        this.error('The page metadata build requires index.html')
      }
      const template = index.source
      for (const page of [...publicPages, ...privatePages]) {
        const html = pageMetadataHtml(template, page)
        if (page.path === '/') index.source = html
        else this.emitFile({ type: 'asset', fileName: `${page.path.slice(1)}/index.html`, source: html })
      }
    },
  }],
  server: { proxy: { '/api/igloo': process.env.IGLOO_API_PROXY || 'http://127.0.0.1:4317' } },
})
