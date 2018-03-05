const accountModel = require('../../models/accountModel'),
    expect = require('chai').expect;

module.exports = async (accountAddress, TCAddress, balance) => {
    let result = await accountModel.findOne({address: accountAddress});

    expect(result).to.be.not.null;
    expect(result).to.have.property('erc20token');
    expect(result.erc20token).to.have.property(TCAddress);
    expect(result.erc20token[TCAddress]).to.equal(balance);
}