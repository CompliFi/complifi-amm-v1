'use strict';

const BigNumber = require('bignumber.js')
const PoolFactory = artifacts.require('PoolFactory');
const Pool = artifacts.require('Pool');
const Vault = artifacts.require('Vault');
const DerivativeSpecification = artifacts.require('DerivativeSpecification');
const PoolView = artifacts.require('PoolView');
const StubToken = artifacts.require('StubToken');

const POOL_FACTORY = {
    '1': '0xfD0BBD821aabC0D91c49fE245a579F220e5f59Ba',
    '4': '0xF8F148ca1F81854d04D301dAfe1092c53fcD9367',
    '137': '0xa7E039A7984834562F8a1CB19cB7fc5819417225',
    '97': '0x9bCd6E3646Bd80a050904032782E70fc8235923F',
    '80001': '0x0Dea8dAba1014b84a9017d5eB46404424A1978d6',
};

const POOL_VIEW = {
    '137': '0xCce5104C4C2c44bE4f374f8C091cEc1E1cf200E4',
    '80001': '0xd862B7ea1B308dd45C38725E1a6594bA0dB4d167',
};

const bn = (num) => new BigNumber(num)

const BONE_DECIMALS = 26;
const BONE = bn(1).times(10 ** BONE_DECIMALS);

const bonify = (value) => bn(value).times(10 ** 3).times(10 ** (BONE_DECIMALS - 3));
const debonify = (value) => bn(value).dividedBy(10 ** (BONE_DECIMALS));

const decify = (value, decimals) => bn(value).times(10 ** decimals);
const undecify = (value, decimals) => bn(value).dividedBy(10 ** decimals);


module.exports = async (done) => {
    const networkType = await web3.eth.net.getNetworkType();
    const networkId = await web3.eth.net.getId();
    const accounts = await web3.eth.getAccounts();
    console.log('network type:' + networkType);
    console.log('network id:' + networkId);
    console.log('accounts:' + accounts);

    try {
        const poolFactory = await PoolFactory.at(POOL_FACTORY[networkId]);
        const poolView = await PoolView.at(POOL_VIEW[networkId]);

        const lastPoolIndex = await poolFactory.getLastPoolIndex.call();

        for (let i = lastPoolIndex; i >= 0; i--) {
            const poolAddress = await poolFactory.getPool.call(i);
            const pool = await Pool.at(poolAddress);
            const derivativeVault = await pool.derivativeVault.call();
            console.log(' ');
            console.log(' ');
            console.log(
                `Pool ${i} with address ${poolAddress} and vault's address ${derivativeVault}`
            );

            const vault = await Vault.at(derivativeVault);
            const derivativeSpecificationAddress = await vault.derivativeSpecification.call();
            const derivativeSpecification = await DerivativeSpecification.at(derivativeSpecificationAddress);
            const symbol = await derivativeSpecification.symbol();
            console.log(`Specification ${symbol} ${derivativeSpecificationAddress}`);

            const collateralAddress = await vault.collateralToken.call();
            const collateral = await StubToken.at(collateralAddress);
            const collateralDecimals = await collateral.decimals.call();

            const poolTokenData = await poolView.getPoolTokenData.call(poolAddress);
            console.log(
                `Primary: ${ undecify(poolTokenData['primaryBalance'], collateralDecimals)}, ${debonify(poolTokenData['primaryLeverage'])}; complement:  ${undecify(poolTokenData['complementBalance'], collateralDecimals)}, ${debonify(poolTokenData['complementLeverage'])}; LP: ${undecify(poolTokenData['lpTotalSupply'], 18)}`
            );

            const balance = await pool.balanceOf(accounts[0]);
            console.log("My LP balance: ", debonify(balance).toFixed());

            const poolInfo = await poolView.getPoolInfo.call(poolAddress, accounts[0]);
            // console.log(JSON.stringify(poolInfo));

            console.log(' ');
            console.log('FEE: ');

            console.log('baseFee', debonify(poolInfo["feeConfig"].baseFee).toString());
            console.log('maxFee', debonify(poolInfo["feeConfig"].maxFee).toFixed());
            console.log('feeAmpPrimary', debonify(poolInfo["feeConfig"].feeAmpPrimary).toFixed());
            console.log('feeAmpComplement', debonify(poolInfo["feeConfig"].feeAmpComplement).toFixed());

            console.log(' ');
            console.log('POOL PARAMS: ');
            console.log('exposureLimitPrimary', debonify(poolInfo["config"].exposureLimitPrimary).toFixed());
            console.log('exposureLimitComplement', debonify(poolInfo["config"].exposureLimitComplement).toFixed());
            console.log('repricerParam1', debonify(poolInfo["config"].repricerParam1).toFixed());
            console.log('repricerParam2', debonify(poolInfo["config"].repricerParam2).toFixed());
            console.log('pMin', debonify(poolInfo["config"].pMin).toFixed());
            console.log('qMin', undecify(poolInfo["config"].qMin, collateralDecimals).toFixed());
            console.log('PLP', poolInfo["config"].controller);
        }
    } catch (e) {
        console.log(e);
        done();
    }

    done();
};
