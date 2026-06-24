import { defineConfig } from 'vite';

// During `npm run dev`, forward the BFF routes to the local Node server
// (`npm run dev:server`) so the SPA and backend behave as same-origin.
export default defineConfig({
    server: {
        proxy: {
            '/auth': 'http://localhost:8084',
            '/api': 'http://localhost:8084',
        },
    },
});
