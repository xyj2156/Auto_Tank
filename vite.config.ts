import { defineConfig } from 'vite';

// base 用相对路径，兼容 GitHub Pages 项目页（/Auto_Tank/）子目录部署
export default defineConfig({
  base: './',
  build: {
    target: 'es2022'
  }
});
