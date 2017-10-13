const _ = require('lodash'),
  Promise = require('bluebird'),
  accountModel = require('../models/accountModel');

const getBalance = async (instance, acc) => {
  const balance = await instance.balanceOf(acc);
  return balance.toNumber();
};

const updateBalance = async (erc20instance, erc20addr, payload) => {
  const from = _.get(payload, 'from') || _.get(payload, 'owner'),
    to = _.get(payload, 'to') || _.get(payload, 'spender'),
    instance = await erc20instance.at(erc20addr);
  let result = [];

  for(let addr of [from, to]) {
    let obj = {};
    const balance = await getBalance(instance, addr);
      
    obj[`erc20token.${erc20addr}`] = balance;
    let res = await accountModel.update({address: addr}, {$set: obj});

    if(res.nModified) 
      result.push({ [addr] : balance });
  }

  return result;
};

module.exports = updateBalance;
