const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'https://3040001nkgk7.vicp.fun/',
            changeOrigin: true,
            pathRewrite: {
                '^/api': 'api'
            }
        })
    );
};