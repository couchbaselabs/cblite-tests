var path = require("path");

var localIP = process.env.LOCAL_IP || '127.0.0.1'
var lsProviders = ['http://'+localIP]
var pouchProviders = []

var config = module.exports = {
  LiteServPath      : process.env.LITESERV_PATH,
  SyncGatewayPath   : process.env.SYNCGATE_PATH,
  LocalListenerIP   : localIP,
  LocalListenerPort : 8189,
  DbUrl             : "walrus:",
  DbBucket          : "db",
  TestEndpoint      : "ios"  // ios, android, pouchdb, couchdb
}

if(process.env.LITESERV_PROVIDERS)
  lsProviders =  process.env.LITESERV_PROVIDERS.split(',')

if(process.env.POUCH_PROVIDERS)
  pouchProviders =  process.env.POUCH_PROVIDERS.split(',')

module.exports.resources = {
  LiteServProviders   : lsProviders,  // array of client providers
  PouchDBProviders    : pouchProviders,
  SyncGatewayProvider : "http://127.0.0.1:8189",
  Provision           : false
}

/*
 * database information in this file will override the values in this config.
 * the default admin_party.json will use "walrus" on bucket "db"
 */
module.exports.SyncGatewayAdminParty = __dirname+"/admin_party.json"
