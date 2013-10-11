var perf = module.exports = {
  testid : "perf_"+process.hrtime()[0],
  numClients : 10,  // number of clients to start will be distributed across providers
  channelsPerClient : 5,  //TODO
  runtime: 40,  // time to run perftest
  requestsPerSec: 1,  // multiplies the writeRatio/(per sec) for 1x/2x/3x testing
  readRatio: 0,  // rate at which client reads it's own docs 
  writeRatio: 10, // rate at which clients creates docs
  perfdb  : "http://127.0.0.1:8190/stats", // perfdb for stat data. default=internal pouch. can be any couchdb|couchcloud"
  workload : 'readwrite',  // workload to run - must be defined in perf/workload.js
  enablepull : true,  // enable/disable pull replication from clients
  gateway : null, // default is to start local gateway
  gatewaydb : "db",  // database the gateway syncs with
  providers : ["http://127.0.0.1:8189"],  // client providers
  db : 'test-perf',   // client db prefix
}
