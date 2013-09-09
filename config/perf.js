var perf = module.exports = {
  testid : "perf_"+process.hrtime()[0],
  numClients : 10,
  channelsPerClient : 5,  //TODO
  channelsPerDoc : 5,   //TODO
  runtime: 40,
  requestsPerSec: 1,
  readRatio: 0,
  writeRatio: 10,
  perfdb  : "http://127.0.0.1:8190/stats",
  // perfdb for stat data. default=internal pouch. can be any couchdb|couchcloud"
  workload : 'readwrite',
  enablepull : true,
  gateway : null, // default is to start local gateway
  gatewaydb : "db",
  providers : ["http://127.0.0.1:8189"],
  db : 'test-perf',   // client db prefix
}
