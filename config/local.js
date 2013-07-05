var path = require("path");

var config = module.exports = {
  LiteServPath : "/Users/tmcafee/Library/Developer/Xcode/DerivedData/CouchbaseLite-hkgaefkqnugcoubpcomqikwhdtwh/Build/Products/Debug/LiteServ",
  SyncGatewayPath : "/Users/tmcafee/sandbox/sync_gateway/bin/sync_gateway",
  Backends : ["walrus:"],
  ListenerIP : "10.32.38.94",
  ListenerPort : 8180,
  LiteServBasePort : 59850,
  SyncGatewayBasePort : 9888
}

module.exports.SyncGatewayAdminParty = __dirname+"/admin_party.json"
