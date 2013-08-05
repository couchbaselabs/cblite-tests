var perf = module.exports = {
  numSyncClients : 10,
  numEmbClients : 1,
  numGateways : 1,
  clientWriteDelay : 50,
  channelsPerClient : 5,
  channelsPerDoc : 5,
  runSeconds : 200,
  requestsPerSec: 1,
  readRatio: 90,
  writeRatio: 10,
  statInterval: 30,
  //PerfDB : "http://console.couchbasecloud.com/perfdash",  ## use for cblite-dashboard integration
}
