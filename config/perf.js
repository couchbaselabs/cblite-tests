var path = require("path");

var perf = module.exports = {
  numSyncClients : 20,
  clientWriteDelay : 50,
  channelsPerClient : 5,
  channelsPerDoc : 5,
  runSeconds : 10
}

// perf.SyncGatewayAdminParty = __dirname+"/admin_party.json"
