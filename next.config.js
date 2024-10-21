const withNextra = require('nextra')('nextra-theme-blog', './theme.config.js')
const nextConfig = {
    output: 'export',
    images: {
      unoptimized: true // mandatory, otherwise won't export
    }
    // Optional: Change the output directory `out` -> `dist`
    // distDir: "build"
  }
module.exports = withNextra(nextConfig)
