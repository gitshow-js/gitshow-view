import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/lib.ts',
            name: 'GitShowView',
            fileName: 'gitshow-view',
            formats: ['es'],
        },
        outDir: 'dist/lib',
        rollupOptions: {
            external: ['reveal.js', 'mime'],
        },
    },
    plugins: [
        dts({ tsconfigPath: './tsconfig.lib.json' }),
    ],
});
