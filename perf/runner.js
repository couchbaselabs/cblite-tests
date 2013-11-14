var fs = require("fs"),
    ini = require("ini"),
    http = require("http"),
    util = require("util"),
    logger = require("../lib/log"),
    spawn = require("child_process").spawn,
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
  logger.info("getting HTML report");
  var hostname = "cbmonitor.sc.couchbase.com",
      path = util.format("/reports/html/?snapshot=all_data&cluster=%s&report=SyncGatewayReport", cluster);

  http.get({hostname: hostname, path: path}, function(response) {
    logger.info("HTML report: http://%s%s", hostname, path);
  });
}

function runWorkload(cluster) {
  logger.info("starting sgw_collector");
  var sgw_collector = spawn("/tmp/env/bin/sgw_collector", ["config/cbagent.ini"], { stdio: 'inherit' });
  logger.info("starting ns_collector");
  var ns_collector = spawn("/tmp/env/bin/ns_collector", ["config/cbagent.ini"], { stdio: 'inherit' });
  logger.info("starting gateload");
  var gateload = spawn("gateload", ["-workload=config/workload.json"], { stdio: 'inherit' });

  sgw_collector.on("close", function () {
    logger.info("sgw_collector was killed");
  });
  ns_collector.on("close", function () {
    logger.info("ns_collector was killed");
  });
  gateload.on("close", function () {
    logger.info("gateload was killed");
  });

  setTimeout(function(cluster) {
    sgw_collector.kill("SIGKILL");
    ns_collector.kill("SIGKILL");
    gateload.kill("SIGKILL");

    getReport(cluster);
  }, workload.RunTimeMs, cluster);
}

(function () {
  var cluster = servers.cluster + "_" + (Math.random()*0xFFF<<0).toString(16);
  logger.info("using %s as cbmonitor cluster", cluster);

  prepareCbAgentConfig(cluster);
  prepareWorkloadConfig();

  runWorkload(cluster);
})();
