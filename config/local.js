var path = require("path");

var config = module.exports = {
  LiteServPath : "/Users/tmcafee/Library/Developer/Xcode/DerivedData/CouchbaseLite-hkgaefkqnugcoubpcomqikwhdtwh/Build/Products/Debug/LiteServ",
  SyncGatewayPath : "/Users/tmcafee/sandbox/sync_gateway/bin/sync_gateway",
  LocalListenerIP : "127.0.0.1",
  LocalListenerPort : 8189,
  DbUrl : "walrus:",
  DbBucket : "db",
}

module.exports.resources = {
  LiteServProviders : ["http://127.0.0.1:8189"],
  SyncGatewayProviders : ["http://127.0.0.1:8189"],
  Provision : true
}

/*
 * database information in this file will override the values in this config.
 * the default admin_party.json will use "walrus" on bucket "db"
 */
module.exports.SyncGatewayAdminParty = __dirname+"/admin_party.json"
