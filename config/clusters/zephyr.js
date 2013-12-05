module.exports = {
    cluster: "zephyr",
    entry_point: "172.23.96.68",
    sync_gateway: [
        "172.23.96.68",
    ],
    couchbase: [
        "http://bucket-1:password@172.23.96.64:8091"
    ],
    "ssh_username": "root",
    "ssh_password": "couchbase"
}
