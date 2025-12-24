/// <reference types="vitest" />
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
// @ts-ignore
import dts from 'vite-plugin-dts'

export default defineConfig({
	build: {
		target: 'es2015',
		lib: {
			entry: process.env.VITE_APP_PATH as string,
			name: 'eventImt',
			formats: ['es', 'cjs'],
			fileName(format, _entryName) {
				return `index.${format}.js`
			}
		},
		rollupOptions: {
			output: {
				exports: 'named'
			}
		}
	},

	plugins: [
		dts({
			rollupTypes: true,
			afterBuild(emittedFiles) {
				const rootPath = path.resolve()
				const reg = /\\/g
				const p = path.join(rootPath, '/dist/index.es.d.ts').replace(reg, '/')
				const content = emittedFiles.get(p) as string
				fs.writeFileSync(path.join(rootPath, '/dist/index.cjs.d.ts'), content)
			}
		})
	]
})
