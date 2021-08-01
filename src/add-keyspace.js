const redis = require("redis");

const KEYSPACE_REGEXP = /^[a-z0-9_]{1,48}$/;

function exec_add_keyspace(args) {
    // initialize redis
    var redisClient;
    if(args.redis_password=="") {
        redisClient = redis.createClient({host: args.redis_host, port: args.port_redis});
    } else {
        redisClient = redis.createClient({host: args.redis_host, port: args.port_redis, password: args.redis_password});
    }
    const currency = args.chain;
    const keyspace = args.keyspace;

    if (KEYSPACE_REGEXP.test(keyspace)==false) {
        console.error("Invalid keyspace name format.");
        process.exit(1);
    }

    const multi = redisClient.multi();
    multi.hmset(currency.toUpperCase()+"::monitored::"+keyspace, "feedFrom", 0, "lastQueuedBlock", -1, "delay", args.delay, "name", keyspace, "lastFilledBlock", -1);
    multi.sadd(currency.toUpperCase()+"::monitored-keyspaces", keyspace);

    multi.exec((errMU, resMU)=>{
        if (errMU) {
            console.error("Redis error:"+errMU);
            process.exit(1);
        }
        console.log("Keyspace added.");
        process.exit(0);
    });
}

module.exports = {exec_add_keyspace};
