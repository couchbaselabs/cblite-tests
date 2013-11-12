var util = require("util"),
    params = require("../config/servers"),
    logger = require("../lib/log"),
    Connection = require("ssh2");

var Installer = function () {
  var version = process.argv.splice(2)[0]; // e.g., 0.0-13

  this.pkg = util.format("couchbase-sync-gateway_%s_x86_64.rpm", version);
  this.link = util.format("http://cbfs-ext.hq.couchbase.com/builds/%s", this.pkg);
};

Installer.prototype.Run = function (installer, c, cmd, callback) {
  logger.info("running remotely: %s", cmd);

  c.exec(cmd, function (err, stream) {
    if (err) {
      throw err;
    }
    stream.on("end", function () {
      callback(installer, c);
    });
  });
};

Installer.prototype.Uninstall = function (installer, c) {
  var cmd = "yes | yum remove couchbase-sync-gateway";
  this.Run(installer, c, cmd, this.Wget);
};

Installer.prototype.Wget = function (installer, c) {
  var cmd = util.format("wget -nc %s -P /tmp/", installer.link);
  installer.Run(installer, c, cmd, installer.Install);
};

Installer.prototype.Install = function (installer, c) {
  var cmd = util.format("rpm -i /tmp/%s", installer.pkg);
  installer.Run(installer, c, cmd, function () { c.end(); });
};

Installer.prototype.Do = function () {
  var that = this;

  params.sync_gateway.forEach(function (server) {
    logger.info("installing Sync Gateway on %s", server);

    var c = new Connection();
    c.on("ready", function () {
      that.Uninstall(that, this);
    });
    c.on("error", function (err) {
      logger.error(err);
    });
    c.connect({
      host: server,
      username: params.ssh_username,
      password: params.ssh_password
    });
  });
};

var installer = new Installer();
installer.Do();
