var path = require("path");

var config = module.exports = {
  LiteServPath      : process.env.LITESERV_PATH,
  SyncGatewayPath   : process.env.SYNCGATE_PATH,
  LocalListenerIP   : "127.0.0.1",
  LocalListenerPort : 8189,
  DbUrl             : "walrus:",
  DbBucket          : "db",
  TestEndpoint      : "ios"  // ios, android, pouchdb, couchdb
}

module.exports.resources = {
  LiteServProviders   : ["http://127.0.0.1:8189"],
  PouchDBProviders    : [],
  SyncGatewayProvider : "http://127.0.0.1:8189",
  Provision           : false
}

/*
 * database information in this file will override the values in this config.
 * the default admin_party.json will use "walrus" on bucket "db"
 */
module.exports.SyncGatewayAdminParty = __dirname+"/admin_party.json"
