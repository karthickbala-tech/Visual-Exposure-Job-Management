import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths: Catalyst serves the client under /app/.
// In development, API calls go to the local Catalyst function server:
//   catalyst serve --only functions:api --http 3100
export default defineConfig({
	base: './',
	plugins: [react()],
	server: {
		port: 5173,
		proxy: { '/server': { target: 'http://localhost:3100', changeOrigin: true } },
	},
});
