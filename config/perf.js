var perf = module.exports = {
  numSyncClients : 10,
  numGateways : 1,
  clientWriteDelay : 50,
  channelsPerClient : 5,
  channelsPerDoc : 5,
  runSeconds : 20,
  requestsPerSec: 10,
  readRatio: 90,
  writeRatio: 10,
}
