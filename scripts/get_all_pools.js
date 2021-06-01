'use strict';

const PoolFactory = artifacts.require('PoolFactory');
const Pool = artifacts.require('Pool');
const Vault = artifacts.require('Vault');
const StubToken = artifacts.require('StubToken');
const PoolView = artifacts.require('PoolView');

module.exports = async (done) => {
    const networkType = await web3.eth.net.getNetworkType();
    const networkId = await web3.eth.net.getId();
    const accounts = await web3.eth.getAccounts();
    console.log('network type:' + networkType);
    console.log('network id:' + networkId);
    console.log('accounts:' + accounts);

    try {
        const poolFactory = await PoolFactory.deployed();
        const poolView = await PoolView.deployed();

        const lastPoolIndex = await poolFactory.getLastPoolIndex.call();

        for (let i = lastPoolIndex; i >= 0; i--) {
            const poolAddress = await poolFactory.getPool.call(i);
            const pool = await Pool.at(poolAddress);
            const derivativeVault = await pool.derivativeVault.call();
            console.log(
                `Pool ${i} with address ${poolAddress} and vault's address ${derivativeVault}`
            );

            const poolTokenData = await poolView.getPoolTokenData.call(poolAddress);
            console.log(
                `Primary: ${poolTokenData['primaryBalance']}, ${poolTokenData['primaryLeverage']}; complement:  ${poolTokenData['complementBalance']}, ${poolTokenData['complementLeverage']}; LP: ${poolTokenData['lpTotalSupply']}`
            );
        }
    } catch (e) {
        console.log(e);
        done();
    }

    done();
};
