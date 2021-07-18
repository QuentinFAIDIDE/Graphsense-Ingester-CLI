const redis = require("redis");

function exec_purge_jobs(args) {
  // initialize redis
  var redisClient =
      redis.createClient({host: args.redis_host, port: args.port_redis});
  let currency = args.chain;
  let keyspace = args.keyspace;

  if(KEYSPACE_REGEXP.test(keyspace)==false) {
      console.error("Invalid keyspace name format.");
      process.exit(1);
  }

  let multi = redisClient.multi();
  multi.del(currency.toUpperCase()+"::jobs::todo");
  multi.del(currency.toUpperCase()+"::jobs::doing");
  multi.del(currency.toUpperCase()+"::jobs::done");
  multi.del(currency.toUpperCase()+"::jobs::errors");

  multi.exec((errMU,resMU)=>{
    if(errMU) {
        console.error("Redis error:"+errMU);
        process.exit(1);
    }
    redisClient.publish(currency+"::purge", "purge");
    console.log("Purge jobs from stacks.");
  })
}

module.exports = { exec_purge_jobs };