require('dotenv/config');

const config = require('../config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose');

mongoose.Promise = Promise;
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});

const expect = require('chai').expect,
  net = require('net'),
  contract = require('truffle-contract'),
  erc20token = require('../build/contracts/TokenContract.json'),
  clearQueues = require('./helpers/clearQueues'),
  connectToQueue = require('./helpers/connectToQueue'),
  clearMongoData = require('./helpers/clearMongoData'),
  expectAccountHasBalance = require('./helpers/expectAccountHasBalance'),
  getBalanceForTCAddress = require('./helpers/getBalanceforTCAddress'),
  saveAccounts = require('./helpers/saveAccounts'),
  consumeMessages = require('./helpers/consumeMessages'),
  erc20contract = contract(erc20token),
  _ = require('lodash'),
  Web3 = require('web3'),
  web3 = new Web3(),
  accountModel = require('../models/accountModel'),
  amqp = require('amqplib'),
  smEvents = require('../controllers/eventsCtrl')(erc20token),
  filterTxsBySMEventsService = require('../services/filterTxsBySMEventsService');

let TC, accounts, amqpInstance;

describe('core/sc processor', function () {

  before(async () => {
    amqpInstance = await amqp.connect(config.rabbit.url);

    let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
    web3.setProvider(provider);
    erc20contract.setProvider(provider);

    accounts = await Promise.promisify(web3.eth.getAccounts)();
    TC = await erc20contract.new({from: accounts[0], gas: 1000000});

    await clearMongoData(); 
    await saveAccounts(accounts, TC.address);
    return await clearQueues(amqpInstance);           
  });

  after(async () => {
    await clearMongoData();
    web3.currentProvider.connection.end();
    return mongoose.disconnect();
  });

  afterEach(async () => {
    return await clearQueues(amqpInstance);
  });

  it('common: check Module /controllers/eventsCtrl', async () => {
    expect(smEvents).to.have.property('eventModels');
    expect(smEvents).to.have.property('signatures');
    const events = _.chain(smEvents.signatures)
      .keys()
      .map(key => smEvents.signatures[key].name)
      .value();
    expect(events).to.include.members(['Transfer', 'Approval']);
  });

  // CREATION
  it('creation: should create an initial balance of 1000000 for the creator', async () => {
    expect(await getBalanceForTCAddress(TC, accounts[0])).to.equal(1000000);
  });

  //TRANSERS
  it('transfer: should transfer 100000 for accounts[0 => 1] and check balances, records in DB and amqp data', async () => {
    return await Promise.all([
      (async() => {
        const transfer = await TC.transfer(accounts[1], 100000, {from: accounts[0]});

        await Promise.delay(5000);
        expect(await getBalanceForTCAddress(TC, accounts[0])).to.equal(900000);
        expect(await getBalanceForTCAddress(TC, accounts[1])).to.equal(100000);
    
        await Promise.delay(20000);
        await expectAccountHasBalance(accounts[0], TC.address, 900000);
        await expectAccountHasBalance(accounts[1], TC.address, 100000);
      })(),
      (async () => {
        const channel = await amqpInstance.createChannel();  
        await connectToQueue(channel);
        return await consumeMessages(2, channel, async (message) => {
          const content = JSON.parse(message.content);
          expect(content).to.contain.all.keys(['address', 'balance']);
          expect(content.address).oneOf([accounts[0], accounts[1]]);

          if (content.address == accounts[0]) {
            expect(content.balance).to.equal(900000);
          } else {
            expect(content.balance).to.equal(100000);
          }
        });
      })()
    ]);
  });

  it('transfer: should transfer 100000 for accounts[1 => 0] and check balances, records in DB and amqp data', async () => {
    return await Promise.all([
      (async() => {
        const transfer = await TC.transfer(accounts[0], 100000, {from: accounts[1]});

        await Promise.delay(5000);
        expect(await getBalanceForTCAddress(TC, accounts[0])).to.equal(1000000);
        expect(await getBalanceForTCAddress(TC, accounts[1])).to.equal(0);
    
        await Promise.delay(15000);
        await expectAccountHasBalance(accounts[0], TC.address, 1000000);
        await expectAccountHasBalance(accounts[1], TC.address, 0);
      })(),
      (async () => {
        const channel = await amqpInstance.createChannel();  
        await connectToQueue(channel);
        return await consumeMessages(2, channel, async (message) => {
          const content = JSON.parse(message.content);
          expect(content).to.contain.all.keys(['address', 'balance']);
          expect(content.address).oneOf([accounts[0], accounts[1]]);

          if (content.address == accounts[0]) {
            expect(content.balance).to.equal(1000000);
          } else {
            expect(content.balance).to.equal(0);
          }
        });
      })()
    ]);
  });

  it('transfer: should transfer 1000 for accounts [2 => 3] and check not message in amqp', async () => {
    const transfer = await TC.transfer(accounts[3], 100000, {from: accounts[2]});
    await Promise.delay(20000);

    const channel = await amqpInstance.createChannel();  
    const queue = await connectToQueue(channel);
    expect(queue.messageCount).to.equal(0);
  });
});
