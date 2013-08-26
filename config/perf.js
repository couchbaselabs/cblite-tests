var perf = module.exports = {
  numClients: 10,
  gateway : null,
  clientWriteDelay : 50,
  channelsPerClient : 5,
  channelsPerDoc : 5,
  runSeconds : 200,
  requestsPerSec: 5,
  readRatio: 90,
  writeRatio: 10,
  statInterval: 10,
  perfdb  : null, // "http://console.couchbasecloud.com/perfdash"   use for cblite-dashboard integration
}
