'use strict';

const PoolView = artifacts.require('PoolView');

module.exports = async (done) => {
    console.log(`starting create_pool, version=${process.env.APP_VERSION}`);
    const networkType = await web3.eth.net.getNetworkType();
    const networkId = await web3.eth.net.getId();
    const accounts = await web3.eth.getAccounts();
    console.log('network type:' + networkType);
    console.log('network id:' + networkId);
    console.log('accounts:' + accounts);

    try {
        console.log('PoolView creating... ');
        const poolView = await PoolView.new();
        console.log('PoolView created: ' + poolView.address);
    } catch (e) {
        console.log(e);
        done();
    }

    done();
};
