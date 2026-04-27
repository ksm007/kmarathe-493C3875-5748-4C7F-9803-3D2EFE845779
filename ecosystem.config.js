module.exports = {
  apps: [
    {
      name: 'turbo-vets-api',
      script: './dist/apps/api/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
