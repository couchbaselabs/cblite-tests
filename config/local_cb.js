var path = require("path");

var config = module.exports = {
  LiteServPath      : process.env.LITESERV_PATH,
  SyncGatewayPath   : process.env.SYNCGATE_PATH,
  LocalListenerIP   : process.env.LOCAL_IP || "127.0.0.1",
  LocalListenerPort : 8189,
  DbUrl             : "http://localhost:8091",
  DbBucket          : "db",
  provides          : "ios",  // ios, android, pouchdb, couchdb
}

/*
 * Now there is one limitation:
 * the bucket db must be created manually with enable flush in advance
 * 
 * database information in this file will override the values in this config.
 * the default admin_party_cb.json will use "http://localhost:8091" on bucket "db"
 */
module.exports.SyncGatewayAdminParty = __dirname+"/admin_party_cb.json"
module.exports.SyncGatewaySyncFunctionTest = __dirname+"/sync_function_test.json"
