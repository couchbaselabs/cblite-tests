var httpProxy = require('http-proxy');

//
// Create a proxy server with custom application logic
//
httpProxy.createServer(function (req, res, proxy) {
  console.log(req.path)
  proxy.proxyRequest(req, res, {
      host: 'localhost',
      port: 5984
    });
}).listen(8080);
