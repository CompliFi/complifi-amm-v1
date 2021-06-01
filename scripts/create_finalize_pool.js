'use strict';

const PoolFactory = artifacts.require('PoolFactory');
const Pool = artifacts.require('Pool');

const VaultFactory = artifacts.require('VaultFactory');
const Vault = artifacts.require('Vault');
const StubToken = artifacts.require('StubToken');

const paused = parseInt(process.env.DELAY_MS || '5000');

const BigNumber = require('bignumber.js');
const bn = (num) => new BigNumber(num);
const BONE = bn(1).times(10 ** 18);
const MAX = web3.utils.toTwosComplement(-1);

const delay = require('delay');
const wait = async (param) => {
    console.log('Delay ' + paused);
    await delay(paused);
    return param;
};

const VAULT_FACTORY_PROXY = {
    "1": "0x3269DeB913363eE58E221808661CfDDa9d898127",
    "4": "0x0d2497c1eCB40F77BFcdD99f04AC049c9E9d83F7",
    "137": "0xE970b0B1a2789e3708eC7DfDE88FCDbA5dfF246a",
    "97": "0x42d002b519820b4656CcAe850B884aE355A4E349",
    "80001": "0x277Dc5711B3D3F2C57ab7d28c5A9430E599ba42C"
};

const POOL_FACTORY = {
    "1": "0xfD0BBD821aabC0D91c49fE245a579F220e5f59Ba",
    "4": "0xF8F148ca1F81854d04D301dAfe1092c53fcD9367",
    "137": "0xa7E039A7984834562F8a1CB19cB7fc5819417225",
    "97": "0x9bCd6E3646Bd80a050904032782E70fc8235923F",
    "80001": "0x0Dea8dAba1014b84a9017d5eB46404424A1978d6"
};

module.exports = async (done) => {
    const networkType = await web3.eth.net.getNetworkType();
    const networkId = await web3.eth.net.getId();
    const accounts = await web3.eth.getAccounts();
    console.log('network type:' + networkType);
    console.log('network id:' + networkId);
    console.log('accounts:' + accounts);

    const CONTROLLER = accounts[0];

    let poolFactoryAddress = process.env.POOL_FACTORY;
    if(!poolFactoryAddress) {
        poolFactoryAddress = POOL_FACTORY[networkId];
    }
    const factory = await PoolFactory.at(poolFactoryAddress);
    console.log('poolFactoryAddress ' + factory.address);

    const collateralTokenDecimals = 6;

    const baseFee = (0.005 * Math.pow(10, 18)).toString();
    const maxFee = (0.40 * Math.pow(10, 18)).toString();
    const feeAmp = 10;

    const qMin = (1 * Math.pow(10, collateralTokenDecimals)).toString();
    const pMin = (0.01 * Math.pow(10, 18)).toString();
    const exposureLimit = (0.25 * Math.pow(10, 18)).toString();
    const volatility = (1.4 * Math.pow(10, 18)).toString();

    let vaultFactoryAddress = process.env.VAULT_FACTORY_PROXY_ADDRESS;
    if(!vaultFactoryAddress) {
        vaultFactoryAddress = VAULT_FACTORY_PROXY[networkId];
    }
    const vaultFactory = await VaultFactory.at(vaultFactoryAddress);
    console.log('vaultFactoryAddress ' + vaultFactory.address);


    const lastVaultIndex = await vaultFactory.getLastVaultIndex.call();
    console.log('Last vault created index ' + lastVaultIndex);
    const vaultAddress = await vaultFactory.getVault.call(lastVaultIndex);
    console.log('Last vault created ' + vaultAddress);

    try {
        console.log('Creating pool... for vault ' + vaultAddress);
        await wait(
            await factory.newPool(
                vaultAddress,
                web3.utils.keccak256('x5Repricer'),
                baseFee,
                maxFee,
                feeAmp
            )
        );
        const lastPoolIndex = await factory.getLastPoolIndex.call();
        console.log('Pool created index ' + lastPoolIndex);
        const poolAddress = await factory.getPool.call(lastPoolIndex);
        console.log('Pool created ' + poolAddress);

        const poolContract = await Pool.at(poolAddress);
        const vaultContract = await Vault.at(vaultAddress);

        const collateralTokenAddress = await vaultContract.collateralToken();
        const primaryTokenAddress = await vaultContract.primaryToken();
        const complementTokenAddress = await vaultContract.complementToken();

        const collateralToken = new web3.eth.Contract(StubToken.abi, collateralTokenAddress);
        console.log('collateralTokenAddress ', collateralTokenAddress);
        const primaryToken = new web3.eth.Contract(StubToken.abi, primaryTokenAddress);
        console.log('primaryTokenAddress ', primaryTokenAddress);
        const complementToken = new web3.eth.Contract(StubToken.abi, complementTokenAddress);
        console.log('complementTokenAddress ', complementTokenAddress);

        // Finalize Pool by controller
        // Mint Collateral Tokens for Admin

        if (networkId !== 1 && networkId !== 137) {
            console.log('Mint collateral');
            await collateralToken.methods
                .mint(CONTROLLER, bn(20).times(10 ** collateralTokenDecimals))
                .send({ from: CONTROLLER });
        }
        // Approve Collateral For vault
        console.log('Approve collateral to vault');
        await collateralToken.methods.approve(vaultAddress, MAX).send({ from: CONTROLLER });

        // Mint Derivatives
        console.log('Mint derivatives');
        await vaultContract.mint(bn(20).times(10 ** collateralTokenDecimals), {
            from: CONTROLLER,
        });

        // 2. Finalize Pool

        console.log('Approve primary to pool');
        await primaryToken.methods
            .approve(poolContract.address, MAX)
            .send({ from: CONTROLLER });

        console.log('Approve complement to pool');
        await complementToken.methods
            .approve(poolContract.address, MAX)
            .send({ from: CONTROLLER });

        console.log('Finalize Pool');
        await poolContract.finalize(
            bn(10).times(10 ** collateralTokenDecimals),
            bn(1.00072789).times(BONE),
            bn(10).times(10 ** collateralTokenDecimals),
            bn(0.99927264).times(BONE),
            exposureLimit,
            volatility,
            pMin,
            qMin,
            { from: CONTROLLER }
        );

    } catch (e) {
        console.log(e);
        done();
    }

    done();
};
