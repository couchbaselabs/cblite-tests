module.exports = {
    cluster: "explorer",
    entry_point: "10.2.1.61",
    sync_gateway: [
        "10.2.1.62",
        "10.2.1.63",
        "10.2.1.64",
        "10.2.1.65"
    ],
    couchbase: [
        "http://bucket-1:password@10.2.1.66:8091",
        "http://bucket-1:password@10.2.1.68:8091"
    ],
    "ssh_username": "root",
    "ssh_password": "couchbase"
}
