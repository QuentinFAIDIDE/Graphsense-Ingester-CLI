const redis = require("redis");

function exec_purge_jobs(args) {
    // initialize redis
    const redisClient =
      redis.createClient({host: args.redis_host, port: args.port_redis});
    const currency = args.chain;
    const keyspace = args.keyspace;

    const multi = redisClient.multi();
    multi.del(currency.toUpperCase()+"::jobs::todo");
    multi.del(currency.toUpperCase()+"::jobs::doing");
    multi.del(currency.toUpperCase()+"::jobs::done");
    multi.del(currency.toUpperCase()+"::jobs::errors");
    multi.del(currency.toUpperCase()+"::jobs::posted");

    multi.exec((errMU, resMU)=>{
        if (errMU) {
            console.error("Redis error:"+errMU);
            process.exit(1);
        }
        redisClient.publish(currency+"::purge", "purge");
        console.log("Purged jobs from stacks.");
        process.exit(0);
    });
}

module.exports = {exec_purge_jobs};
