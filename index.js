const _ = require('lodash'),
  amqp = require('amqplib'),
  net = require('net'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  contract = require('truffle-contract'),
  Web3 = require('web3'),
  config = require('./config'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'core.chronoErc20Processor'}),
  transactionModel = require('./models/transactionModel'),
  updateBalance = require('./services/updateBalance'),
  filterTxsBySMEventsService = require('./services/filterTxsBySMEventsService');

mongoose.Promise = Promise;
mongoose.connect(config.mongo.uri, {useMongoClient: true});

const defaultQueue = 'app_eth.chrono_eth20_processor';
const erc20token = require('./build/contracts/TokenContract.json');
const smEvents = require('./controllers/eventsCtrl')(erc20token);

let init = async () => {
  let conn = await amqp.connect(config.rabbit.url);
  let channel = await conn.createChannel();

  // setup RPC provider 
  let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
  const web3 = new Web3();
  web3.setProvider(provider);

  let Erc20Contract = contract(erc20token);
  Erc20Contract.setProvider(provider);

  // setup amqp
  try {
    await channel.assertExchange('events', 'topic', {durable: false});
    await channel.assertQueue(defaultQueue);
    await channel.bindQueue(defaultQueue, 'events', 'eth_transaction.*');
  } catch (e) {
    log.error(e);
    channel = await conn.createChannel();
  }
  
  const parseJson = async function (data) {
    return JSON.parse(data);
  };

  channel.prefetch(5);
  // listen to the amqp bus
  channel.consume(defaultQueue, async (data) => {
    let blockPayload;
    channel.ack(data);

    blockPayload = await parseJson(data.content.toString())
      .catch(err => log.error(err));

    let tx = await transactionModel.findOne({payload: blockPayload});
    if (!tx) return;

    let filtered = await filterTxsBySMEventsService(tx, web3, smEvents);
    // console.log('filtered >', filtered.length);
    
    // save ETC20 Events to DB
    await Promise.all(
      _.map(filtered, async (ev, index) => {
        if (!ev) return;
        
        const result = await updateBalance(Erc20Contract, tx.logs[index].address, ev.payload);        
        let addresses = _.chain(result).map(_.keys).flatten().value();

        return await Promise.all(
          addresses.map(account => 
            channel.publish('events', `eth_erc20token_balance.${account}`, new Buffer(JSON.stringify(_.find(result, account)[account])))
          )
        )
        .catch(err => console.log(err));

        ev.payload.save().catch(() => {});
      })
    );

    if(tx.logs.length >0) {
      log.info(tx.logs[0].topics);
    }
  });
};

module.exports = init();
