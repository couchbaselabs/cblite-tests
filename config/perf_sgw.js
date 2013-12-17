module.exports = {
	"log": ["CRUD", "REST+"],
	"adminInterface": ":4985",
	"maxIncomingConnections": 0,
	"maxCouchbaseConnections": 1024,
	"databases": {
		"db": {
			"server": null,
			"bucket": "bucket-1",
			"users": {
				"GUEST": { "disabled": true },
			}
		}
	}
}
