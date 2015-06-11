var launcher = require("../lib/launcher"),
    ini = require("ini"),
    fs = require("fs"),
    common = require("../tests/common"),
    conf_file = process.env.CONF_FILE || 'local',
    config = require('../config/' + conf_file),
    test = require("tap").test;


test("create bucket",
    function (t) {
        if (config.DbUrl.indexOf("http") > -1) {
            var ini_file_config = ini.parse(fs.readFileSync(config.cluster_ini_file, "utf-8"));

            var user = "Administrator"//ini_file_config.global.rest_username;
            var password = "password"//ini_file_config.global.rest_password;
            var servers = ini_file_config.servers;
            var bucket = ini_file_config.bucket.bucket1;
            var server = "localhost"//servers.vm1.substring(0, servers.vm1.indexOf(":"));
            var port = 8091//servers.vm1.substring(servers.vm1.indexOf(":") + 1);

            var post_data = "name=" + bucket + "&parallelDBAndViewCompaction=false&autoCompactionDefined=false&threadsNumber=3&replicaIndex=0&replicaNumber=1&saslPassword=&authType=sasl&ramQuotaMB=200&bucketType=membase&flushEnabled=1";
            var options = {
                host: server,
                port: port,
                path: '/pools/default/buckets',
                method: 'POST',
                auth: user + ":" + password,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': post_data.length
                }
            };
            common.http_post_api(t, post_data, options, 202, function (callback) {t.end()});
        } else {
            t.end();
        };

    });


