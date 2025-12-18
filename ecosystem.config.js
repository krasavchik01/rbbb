export default {
  apps: [
    {
      name: 'rb-suite',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'src'],
      max_memory_restart: '500M',
      error_file: '/var/log/pm2/rb-suite-error.log',
      out_file: '/var/log/pm2/rb-suite-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
