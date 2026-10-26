/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Load these straight from node_modules on the server instead of bundling
    // them. Bundled, mammoth's zip reader (jszip) fails on real .docx files
    // with "uncompressed data size mismatch", so the AI pre-check got no text.
    serverComponentsExternalPackages: ["mammoth", "pdf-parse"],
  },
};

export default nextConfig;
