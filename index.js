/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Middleware service for handling ERC20 token smart contracts
 * @module Chronobank/eth-erc20
 * @requires models/pinModel
 * @requires services/updateBalance
 * @requires services/filterTxsBySMEventsService
 */

const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose');

mongoose.Promise = Promise;
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const amqp = require('amqplib'),
  net = require('net'),
  contract = require('truffle-contract'),
  Web3 = require('web3'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'core.chronoErc20Processor'}),
  updateBalance = require('./services/updateBalance'),
  filterTxsBySMEventsService = require('./services/filterTxsBySMEventsService');

[mongoose.accounts, mongoose.connection].forEach(connection =>
  connection.on('disconnected', function () {
    log.error('mongo disconnected!');
    process.exit(0);
  })
);

const defaultQueue = `app_${config.rabbit.serviceName}.chrono_eth20_processor`;
const erc20token = require('./build/contracts/TokenContract.json');
const smEvents = require('./controllers/eventsCtrl')(erc20token);

let init = async () => {
  let conn = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('rabbitmq is not available!');
      process.exit(0);
    });

  let channel = await conn.createChannel();

  channel.on('close', () => {
    log.error('rabbitmq process has finished!');
    process.exit(0);
  });

  let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
  const web3 = new Web3();
  web3.setProvider(provider);

  web3.currentProvider.connection.on('end', () => {
    log.error('ipc process has finished!');
    process.exit(0);
  });

  web3.currentProvider.connection.on('error', () => {
    log.error('ipc process has finished!');
    process.exit(0);
  });

  let Erc20Contract = contract(erc20token);
  Erc20Contract.setProvider(provider);

  await channel.assertExchange('events', 'topic', {durable: false});
  await channel.assertQueue(defaultQueue);
  await channel.bindQueue(defaultQueue, 'events', `${config.rabbit.serviceName}_transaction.*`);

  channel.prefetch(2);
  channel.consume(defaultQueue, async (data) => {
    try {
      let block = JSON.parse(data.content.toString());
      let tx = await Promise.promisify(web3.eth.getTransactionReceipt)(block.hash);
      let filtered = tx ? await filterTxsBySMEventsService(tx, web3, smEvents) : [];

      for (let i = 0; i < filtered.length; i++) {
        let event = filtered[i];
        let updatedBalances = await updateBalance(Erc20Contract, tx.logs[i].address, event.payload);
        await event.payload.save().catch(() => {
        });

        for (let updateBalance of updatedBalances)
          channel.publish('events', `${config.rabbit.serviceName}_chrono_eth20_processor.${event.name.toLowerCase()}`, new Buffer(JSON.stringify(updateBalance)));
      }
    } catch (e) {
      log.error(e);
    }

    channel.ack(data);
  });
};

module.exports = init();
