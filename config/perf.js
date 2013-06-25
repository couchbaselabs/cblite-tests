var path = require("path");

var perf = module.exports = {
  numSyncClients : 20,
  clientWritesPerSecond : 5,
  channelsPerClient : 5,
  channelsPerDoc : 5
}

// perf.SyncGatewayAdminParty = __dirname+"/admin_party.json"
