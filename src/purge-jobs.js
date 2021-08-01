const redis = require("redis");

function exec_purge_jobs(args) {
    // initialize redis
    // initialize redis
    var redisClient;
    if(args.redis_password=="") {
        redisClient = redis.createClient({host: args.redis_host, port: args.port_redis});
    } else {
        redisClient = redis.createClient({host: args.redis_host, port: args.port_redis, password: args.redis_password});
    }
    const currency = args.chain;
    const keyspace = args.keyspace;

    const multi = redisClient.multi();
    multi.del(currency.toUpperCase()+"::jobs::todo");
    multi.del(currency.toUpperCase()+"::jobs::doing");
    multi.del(currency.toUpperCase()+"::jobs::done");
    multi.del(currency.toUpperCase()+"::jobs::errors");
    multi.del(currency.toUpperCase()+"::jobs::posted");

    // reset the metrics
    multi.del(currency.toUpperCase()+"::metrics-data::redis-timeouts");
    multi.del(currency.toUpperCase()+"::metrics-data::jobTimeout");
    multi.del(currency.toUpperCase()+"::metrics::master-routine-time");
    multi.del(currency.toUpperCase()+"::metrics::redis-timeout");
    multi.del(currency.toUpperCase()+"::metrics::avg-job-time");
    multi.del(currency.toUpperCase()+"::metrics::avg-block-time");
    multi.del(currency.toUpperCase()+"::metrics::cassandra-timeout");

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
