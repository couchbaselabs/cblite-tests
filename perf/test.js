var resources = require("../config/local").resources,
  async = require("async"),
  workloads = require("../perf/workloads"),
  config = require("../config/local"),
  perf = require("../config/perf"),
  initialize = require('../perf/initialize'),
  setup = require('../perf/setup'),
  coax = require("coax");

var params = {}
var providers = []
var gateway = null
var runtime = 300
var localListener = 'http://'+config.LocalListenerIP+':'+config.LocalListenerPort

run = module.exports.run = function(opts, done){

  params = opts
  providers = params.providers
  runtime = params.runtime

  // when ready start statcollector if perfdb set
  var ready = function(errors, ok){
    if(params.perfdb){
      pushTestInfo()
      runStatCollector()
    }
    done({err: errors, ok : params})
  }

  async.series([_initialize,
                _setup,
                startload],
    ready)

  setTimeout(function(){
    stop(params.listener, params.providers)
  }, params.runtime * 1000)
}

stop = module.exports.stop = function(listener, providers, done){

  // stop collector
  coax.get([listener,"stop","statcollector"])

  async.map(providers, function(url, cb){

    // stop all workloads
    coax.get([url,"stop","workload"], function(){

      // cleanup
      coax.get([url,"cleanup"], cb)
    })
  }, function(err, result){
    if(done){
      done({ err: err, ok : 'stop test'})
    }
  })
}

function pushTestInfo(){

  var doc = {
    id : params.testid+"_info",
    testid : params.testid,
    numClients : params.numClients,
    readRatio : params.readRatio,
    writeRatio : params.writeRatio,
    requestsPerSec : params.requestsPerSec,
    runtime : runtime
  }

  coax.post([params.perfdb], doc, function(err, json){
    console.log({ok : doc, err : err})
  })
}

function _initialize(done){

  // do general init/set based on params
  // before running specific test

    initialize(params,  function(err, ok){
    if(err.error){
      console.log("Error occured setup clients")
      console.log(err.error)
    }
    setTimeout(function(){
      done(err.error, {ok : 'client initialize'})
    }, 2000)

  })

}

function _setup(done){

  setup(params, function(err, ok){
    if(err.error){
      console.log("Error occured setup clients")
      console.log(err.error)
    }
    done(err.error, {ok : 'clients setup'})
  })

}

function runStatCollector(cb){


   var lsprovider = resources.LiteServProviders[0]
   // get an ios client

  coax([lsprovider, "clients"],  function(err, clients){
    if ((!err)){
      var monitorClient = clients.ok[0]
      coax([monitorClient, '_all_dbs'], function(err, dbs){

        if(!err && (dbs.length > 0)){
          var monitorClientDb = dbs[0].replace(/.*:\/\//,"")
          params.monitorClient = coax([monitorClient,monitorClientDb]).pax().toString()
          console.log("MonitorClient: "+params.monitorClient)
          coax.post([lsprovider,"start", "statcollector"], params, function(errors, res){
            cb(res)
            console.log({err : errors, ok : res})
          })
       }
     })
    } else{
      console.log(err)
      console.log("Unable to get a monitor client!")
    }
  })

}

function startload(done){

  async.map(providers, function(url, cb){

    coax.post([url, "start","workload",params.workload], params,  cb)
    }, function(err, ok){
      if(err){
        console.log("Error occured starting workload clients")
        console.log(err)
      }
      done(err, {ok : 'workloads started'})
 })
}

