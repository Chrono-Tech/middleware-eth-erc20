/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

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
  erc20contract = contract(erc20token),
  _ = require('lodash'),
  Web3 = require('web3'),
  web3 = new Web3(),
  accountModel = require('../models/accountModel'),
  smEvents = require('../controllers/eventsCtrl')(erc20token),
  filterTxsBySMEventsService = require('../services/filterTxsBySMEventsService');

let TC, accounts, transfer;

describe('core/sc processor', function () {

  before(async () => {
    let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
    web3.setProvider(provider);
    await accountModel.remove({});
    erc20contract.setProvider(provider);

    accounts = await Promise.promisify(web3.eth.getAccounts)();
    TC = await erc20contract.new({from: accounts[0], gas: 1000000});
  });

  after(() => {
    web3.currentProvider.connection.end();
    return mongoose.disconnect();
  });

  it('add account to mongo', async () => {
    await new accountModel.insertMany([{address: accounts[0], erc20token: {[TC.address]: 0}}, {address: accounts[1]}])
      .catch(err => console.error(err));
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
    let balance = await TC.balanceOf.call(accounts[0]);
    expect(balance.toNumber()).to.equal(1000000);
  });

  //TRANSERS
  it('transfer: should transfer 100000 from creator to account[1]', async () => {
    let balance = [];
    transfer = await TC.transfer(accounts[1], 100000, {from: accounts[0]});
    await Promise.delay(5000);
    balance[0] = await TC.balanceOf.call(accounts[0]);
    balance[1] = await TC.balanceOf.call(accounts[1]);

    expect(balance[0].toNumber()).to.equal(900000);
    expect(balance[1].toNumber()).to.equal(100000);
  });

  it('transfer: check DB creator account record', async () => {
    await Promise.delay(15000);
    let result = await accountModel.findOne({address: accounts[0]});

    expect(result).to.have.property('erc20token');
    expect(result.erc20token).to.have.property(TC.address);
    expect(result.erc20token[TC.address]).to.equal(900000)
  });

  it('transfer: check DB recipient account record', async () => {
    let result = await accountModel.findOne({address: accounts[1]});

    expect(result).to.have.property('erc20token');
    expect(result.erc20token).to.have.property(TC.address);
    expect(result.erc20token[TC.address]).to.equal(100000);
  });

  it('transfer: should transfer from account[1] account[0]', async () => {
    let balance = [];
    transfer = await TC.transfer(accounts[0], 100000, {from: accounts[1]});
    await Promise.delay(5000);
    balance[0] = await TC.balanceOf.call(accounts[0]);
    balance[1] = await TC.balanceOf.call(accounts[1]);

    expect(balance[0].toNumber()).to.equal(1000000);
    expect(balance[1].toNumber()).to.equal(0);
  });
});
