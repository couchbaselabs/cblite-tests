var path = require("path");

var localIP, lsProviders, pouchProviders = null

envSetup()

var config = module.exports = {
  LiteServPath      : process.env.LITESERV_PATH,
  SyncGatewayPath   : process.env.SYNCGATE_PATH,
  LocalListenerIP   : localIP,
  LocalListenerPort : 8189,
  DbUrl             : "walrus:",
  DbBucket          : "db",
  TestEndpoint      : "ios"  // ios, android, pouchdb, couchdb
}

module.exports.resources = {
  LiteServProviders   : lsProviders,  // array of other Listeners...ie [http://10.10.1.1:8189, http://...]
  PouchDBProviders    : pouchProviders,
  SyncGatewayProvider : "http://127.0.0.1:8189",
  Provision           : false
}

/*
 * database information in this file will override the values in this config.
 * the default admin_party.json will use "walrus" on bucket "db"
 */
module.exports.SyncGatewayAdminParty = __dirname+"/admin_party.json"
module.exports.SyncGatewaySyncFunctionTest = __dirname+"/sync_function_test.json"


/*
 ****** ENV CONFIG *****
 */
function envSetup(){

  localIP = process.env.LOCAL_IP || '127.0.0.1'
  lsProviders = ['http://'+localIP]
  pouchProviders = []

  // ie. export LITESERV_PROVIDERS="http://127.0.0.1:8189,http://127.0.0.2:8189,http://127.0.0.3:8189"
  if(process.env.LITESERV_PROVIDERS != undefined)
    lsProviders =  process.env.LITESERV_PROVIDERS.split(',')
      .filter(function(serv){ if (serv !='' ) return true })

  if(process.env.POUCH_PROVIDERS != undefined)
    pouchProviders =  process.env.POUCH_PROVIDERS.split(',')
      .filter(function(serv){ if (serv !='' ) return true })

}
