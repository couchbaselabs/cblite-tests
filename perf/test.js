var resources = require("../config/local").resources,
    async = require("async"),
    workloads = require("../perf/workloads"),
    conf_file = process.env.CONF_FILE || 'local',
    config = require('../config/' + conf_file),
    initialize = require('../perf/initialize'),
    setup = require('../perf/setup'),
    coax = require("coax");

var params = {},
    providers = [],
    gateway = null,
    runtime = 300,
    localListener = 'http://' + config.LocalListenerIP + ':' + config.LocalListenerPort;

run = module.exports.run = function(opts, started, complete) {
  params = opts;
  providers = params.providers;
  runtime = params.runtime;

  // when ready start statcollector if perfdb set
  var ready = function(errors, ok) {
    if (params.perfdb) {
      pushTestInfo();
      runStatCollector();
    }
    started({err: errors, ok: params});
  };

  async.series([_initialize,
                _setup,
                startload],
               ready);

  setTimeout(function() {
    stop(params.providers, complete);
  }, params.runtime * 1000);
};

stop = module.exports.stop = function(providers, complete) {
  async.map(providers, function(url, cb) {
    // stop any stat collectors
    coax.get([url,"stop","statcollector"], function(js) {
      // stop all workloads
      coax.get([url,"stop","workload"], cb);
    });

  }, function(err, result) {
    // wait for workloads to finish
    setTimeout(function() {
      // stop any initialized resources
      initialize.cleanup(function(err, result) {
        //console.log(result)
        if (complete) {
          complete({ err: err, ok : result.ok});
        }
      });
    }, 10000);
  });
};

function pushTestInfo() {
  var doc = {
    id: params.testid+"_info",
    testid: params.testid,
    numClients: params.numClients,
    readRatio: params.readRatio,
    writeRatio: params.writeRatio,
    requestsPerSec: params.requestsPerSec,
    runtime: runtime
  };

  coax.post([params.perfdb], doc, function(err, json) {
    console.log({ok: doc, err: err});
  });
}

/*
  Do general init/set based on params before running specific test
*/
function _initialize(done) {
  initialize(params,  function(res) {
    if(res.error) {
      console.log("Error occured setup clients");
      console.log(res.error);
    } else {
      console.log(res);
      params.gateway = res.gateway;
      params.sg = res.sg;
    }
    setTimeout(function() {
      done(res.error, {ok: 'client initialize'});
    }, 2000);
  });
}

function _setup(done) {
  setup(params, function(res) {
    if (res.error) {
      console.log("Error occured setup clients");
      console.log(res.error);
    }
    done(res.error, {ok: 'clients setup'});
  });
}

function runStatCollector(done) {
  var monitorClient = null;
  var iosProvider = null;

  // looping through providers looking for an ios provider
  async.map(params.providers, function(provider, _cb) {
    coax(provider, function(e, js) {
      if(js && ('provider' in js) && (js.provider === 'ios')) {
        // this is an ios provider...get clients
        coax([provider, "clients"], function(err, clients) {
          monitorClient = clients.ok[0];
          // get client db to monitor
          coax([monitorClient, '_all_dbs'], function(err, dbs) {
            if(!err && (dbs.length > 0)) {
              // set client url
              var monitorClientDb = dbs[0].replace(/.*:\/\//, "");
              monitorClient = coax([monitorClient,monitorClientDb]).pax().toString();
              iosProvider = provider;
            }
          _cb(err, {ok : monitorClient});
          });
        });
      } else {
        _cb(e, {ok : 'non-ios'});
      }
    });
  }, function(err, oks) {
    if(monitorClient) {
      params.monitorClient = monitorClient;
      console.log("MonitorClient: " + params.monitorClient);
      coax.post([iosProvider, "start", "statcollector"], params, function(errors, res) {
        if (done) {
          done(res);
        }
        console.log({err: errors, ok: res});
      });
    } else {
      if (done) {
        done({ok : "no ios providers?"});
      }
    }
  });
}

function startload(done) {
  async.map(providers, function(url, cb) {
    coax.post([url, "start","workload",params.workload], params, cb);
    }, function(err, ok) {
      if(err) {
        console.log("Error occured starting workload clients");
        console.log(err);
      }
      done(err, {ok: 'workloads started'});
 });
}
