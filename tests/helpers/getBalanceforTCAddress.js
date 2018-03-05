module.exports = async (TC, accountAddress) => {
    const balance = await TC.balanceOf.call(accountAddress);
    return balance.toNumber();
};