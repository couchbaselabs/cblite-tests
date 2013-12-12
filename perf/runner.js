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
    } else {
      prepareWorkloadConfig(cluster)
    }
  });
}

function prepareWorkloadConfig(cluster) {
  logger.info("preparing workload config");

  workload.Hostname = servers.entry_point;
  workload.SerieslyDatabase = cluster;

  fs.writeFile("config/workload.json", JSON.stringify(workload, null, 4), function(err) {
    if (err) {
      logger.error(err);
    } else {
      runWorkload(cluster);
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

function spawnBgProcess(process, cmd, args) {
  logger.info("starting " + process);
  var p = spawn(cmd, args, { stdio: 'inherit' });
  p.on("close", function () {
    logger.info(process + " was killed");
  });
  return p
}

function runWorkload(cluster) {
  var processes = [];

  processes.push(
    spawnBgProcess("sgw_collector", "/tmp/env/bin/sgw_collector", ["config/cbagent.ini"])
  );
  processes.push(
    spawnBgProcess("ns_collector", "/tmp/env/bin/ns_collector", ["config/cbagent.ini"])
  );
  processes.push(
    spawnBgProcess("ps_collector", "/tmp/env/bin/ps_collector", ["config/cbagent.ini"])
  );
  processes.push(
    spawnBgProcess("gateload", "gateload", ["-workload=config/workload.json"])
  );
  processes.push(
    gocbagent = spawnBgProcess("go-cbagent", "go-cbagent", ["-workload=config/workload.json"])
  );

  setTimeout(function(cluster) {
    for (var i=0, l=processes.length; i<l; i++) {
      processes[i].kill("SIGKILL");
    }

    getReport(cluster);
  }, workload.RunTimeMs, cluster);
}

(function () {
  var cluster = servers.cluster + "_" + (Math.random()*0xFFF<<0).toString(16);
  logger.info("using %s as cbmonitor cluster", cluster);

  prepareCbAgentConfig(cluster);
})();
