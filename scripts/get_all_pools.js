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
        const poolViewAddress = "0x8Ebb991245BAbB8083e56d61d6014e366A85b0BC";
        const poolView = await PoolView.at(poolViewAddress);

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

            const poolConfig = await poolView.getPoolConfig.call(poolAddress);
            console.log(
              `repricerParam1: ${poolConfig['repricerParam1']}, repricerParam2: ${poolConfig['repricerParam2']}`
            );
        }
    } catch (e) {
        console.log(e);
        done();
    }

    done();
};
