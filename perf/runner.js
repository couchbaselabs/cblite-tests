var fs = require("fs"),
    ini = require("ini"),
    http = require("http"),
    util = require("util"),
    logger = require("../lib/log"),
    servers = require("../config/servers"),
    workload = require("../config/workload");

function prepareCbAgentConfig(cluster) {
  logger.info("preparing cbagent config");

  var config = ini.parse(fs.readFileSync("config/cbagent.ini.sample", "utf-8"));

  config.target.cluster = cluster;
  config.target.master_node = servers.couchbase[0].replace(/http.+@/, "").replace(":8091", "");
  config.target.sync_gateway_nodes = servers.sync_gateway.join(" ");
  config.target.ssh_username = servers.ssh_username;
  config.target.ssh_password = servers.ssh_password;

  fs.writeFile("config/cbagent.ini", ini.stringify(config), function(err) {
    if (err) {
      logger.error(err);
    }
  });
}

function prepareWorkloadConfig() {
  logger.info("preparing workload config");

  workload.Hostname = servers.entry_point;

  fs.writeFile("config/workload.json", JSON.stringify(workload, null, 4), function(err) {
    if (err) {
      logger.error(err);
    }
  }); 
}

function getReport(cluster) {
  var path = util.format("/reports/html/?snapshot=all_data&cluster=%s&report=SyncGatewayReport", cluster),
      options = { hostname: "cbmonitor.sc.couchbase.com", path: path };

  var req = http.request(options, function(response) {
    response.on('end', function () {
      logger.info("HTML report: %s", path);
    });
  });

  req.setTimeout(600000, function () {
    req.abort();
    logger.error("request timeout");
  });

  req.end();
}

(function () {
  var cluster = servers.cluster + "_" + (Math.random()*0xFFF<<0).toString(16);

  prepareCbAgentConfig(cluster);
  prepareWorkloadConfig();

  setInterval(function() {
    getReport(cluster);
  }, workload.RunTimeMs);
})();
