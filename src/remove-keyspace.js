const redis = require('redis');

function exec_remove_keyspace(args) {
  // initialize redis
  var redisClient =
      redis.createClient({host: args.redis_host, port: args.port_redis});
  let currency = args.chain;
  let keyspace = args.keyspace;

  let multi = redisClient.multi();
  multi.del(currency.toUpperCase()+"::monitored::"+keyspace);
  multi.srem(currency.toUpperCase()+"::monitored-keyspaces", keyspace);

  multi.exec((errMU,resMU)=>{
    if(errMU) {
        console.error("Redis error:"+errMU);
        process.exit(1);
    }
    console.log("All keyspaces with this name have been cleared from monitoring lists.");
    process.exit(0);
  })
}

module.exports = {exec_remove_keyspace};