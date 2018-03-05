const accountModel = require('../../models/accountModel');
module.exports = async (accounts, TCAddress) => {
    await new accountModel.insertMany([{address: accounts[0], erc20token: {[TCAddress]: 0}}, {address: accounts[1]}])
    .catch(err => console.error(err));
};