// use the liteserve phalanx and the sync-gateway launcher to apply concurrent sync sessions to a sync sync-gateway

// each device follows N channels
// each device writes to N*N channels
// total channel space of (N channels * N devices)^2

// for each write  to a liteserv, time how long it takes to show up on
// the changes feeds of other devices that are following the channels
// it wrote to. Also make sure the document is not on devices
// that aren't allowed to see those channels.
