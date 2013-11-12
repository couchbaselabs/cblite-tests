var fs = require('fs'),
    servers = require("../config/servers"),
    config = require("../config/perf_sgw"),
    logger = require("../lib/log"),
    ssh = require("ssh2"),
    scp = require("scp2");

config.databases.db.server = servers.couchbase[0];

function startGateway(server) {
  var c = new ssh(),
      cmd = "ulimit -n 65536 && /opt/couchbase-sync-gateway/bin/sync_gateway /tmp/config.json &>/tmp/gateway.log &";
  c.on("ready", function () {
    logger.info("starting Sync Gateway on %s", server);
    c.exec(cmd, function (err, stream) {
      if (err) {
        logger.error(err);
      }
      stream.on("exit", function () {
        c.end();
      });
    });
  });
  c.on("error", function (err) {
    logger.error(err);
  });
  c.connect({
    host: server,
    username: servers.ssh_username,
    password: servers.ssh_password
  });
}

function uploadConfigs() {
  servers.sync_gateway.forEach(function (server) {
    logger.info("uploading config to %s", server);

    var c = new scp.Client({
      host: server,
      username: servers.ssh_username,
      password: servers.ssh_password
    });

    c.upload("/tmp/config.json", "/tmp", function(err) {
      c.close();
      if (err) {
        logger.error(err);
      } else {
        startGateway(server);
      }      
    })
  });
}

!(function () {
  fs.writeFile("/tmp/config.json", JSON.stringify(config, null, 4), function(err) {
    if (err) {
      logger.error(err);
    } else {
      uploadConfigs();
    }
  });
})();
