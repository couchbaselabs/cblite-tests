var path = require("path");

var config = module.exports = {
  LiteServPath : "/Users/couchbase/buildbox/couchbase-lite-ios/build/Release/LiteServ",
  SyncGatewayPath : "/Users/couchbase/buildbox/sync_gateway/bin/sync_gateway",
  LocalListenerIP : "127.0.0.1",
  LocalListenerPort : 8189,
  DbUrl : "walrus:",
  DbBucket : "db",
  TestEndpoint : "ios"  // ios, android, pouchdb, couchdb
}

module.exports.resources = {
  LiteServProviders : ["http://127.0.0.1:8189"],
  PouchDBProviders : [],
  SyncGatewayProvider : "http://127.0.0.1:8189",
  Provision : false
}

/*
 * database information in this file will override the values in this config.
 * the default admin_party.json will use "walrus" on bucket "db"
 */
module.exports.SyncGatewayAdminParty = __dirname+"/admin_party.json"
