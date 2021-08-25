'use strict';

const PoolFactory = artifacts.require('PoolFactory');
const Pool = artifacts.require('Pool');

const VaultFactory = artifacts.require('VaultFactory');
const Vault = artifacts.require('Vault');
const DerivativeSpecification = artifacts.require('DerivativeSpecification');
const StubToken = artifacts.require('StubToken');

const paused = parseInt(process.env.DELAY_MS || '5000');

const BigNumber = require('bignumber.js');
const bn = (num) => new BigNumber(num);
const BONE_DECIMALS = 26;
const MAX = web3.utils.toTwosComplement(-1);

const delay = require('delay');
const wait = async (param) => {
    console.log('Delay ' + paused);
    await delay(paused);
    return param;
};

const VAULT_FACTORY_PROXY = {
    '1': '0x3269DeB913363eE58E221808661CfDDa9d898127',
    '4': '0x0d2497c1eCB40F77BFcdD99f04AC049c9E9d83F7',
    '137': '0xE970b0B1a2789e3708eC7DfDE88FCDbA5dfF246a',
    '97': '0x42d002b519820b4656CcAe850B884aE355A4E349',
    '80001': '0x277Dc5711B3D3F2C57ab7d28c5A9430E599ba42C',
};

const POOL_FACTORY = {
    '1': '0xfD0BBD821aabC0D91c49fE245a579F220e5f59Ba',
    '4': '0xF8F148ca1F81854d04D301dAfe1092c53fcD9367',
    '137': '0xa7E039A7984834562F8a1CB19cB7fc5819417225',
    '97': '0x9bCd6E3646Bd80a050904032782E70fc8235923F',
    '80001': '0x0Dea8dAba1014b84a9017d5eB46404424A1978d6',
};

const bonify = (value) => bn(value).times(10 ** 3).times(10 ** (BONE_DECIMALS - 3));
const decify = (value, decimals) => bn(value).times(10 ** decimals);

const FEE_PARAMS = {
    'x5': {
        'baseFee': bonify(0.03),
        'maxFee': bonify(0.40),
        'feeAmpPrimary': bonify(10),
        'feeAmpComplement': bonify(10)
    },
    'Call': {
        'baseFee': bonify(0.03),
        'maxFee': bonify(0.30),
        'feeAmpPrimary': bonify(50),
        'feeAmpComplement': bonify(1)
    }
}

const FINALIZE_PARAMS = {
    'x5': {
        'exposureLimitPrimary': bonify(0.25),
        'exposureLimitComplement': bonify(0.25),
        'USDC': {
            'qMin': 1,
            'pMin': bonify(0.03)
        },
        'ETH': {
            'repricerParam1': bonify(1.10),
            'repricerParam2': bonify(0.90),
        },
        'BTC': {
            'repricerParam1': bonify(1.00),
            'repricerParam2': bonify(0.85),
        },
        'MATIC': {
            'repricerParam1': bonify(1.60),
            'repricerParam2': bonify(1.30),
        },
        'LINK': {
            'repricerParam1': bonify(1.60),
            'repricerParam2': bonify(1.30),
        },
        'AAVE': {
            'repricerParam1': bonify(1.60),
            'repricerParam2': bonify(1.30),
        },
        'COMP': {
            'repricerParam1': bonify(1.60),
            'repricerParam2': bonify(1.30),
        },
        'UNI': {
            'repricerParam1': bonify(1.60),
            'repricerParam2': bonify(1.30),
        },
    },
    'Call': {
        'exposureLimitPrimary': bonify(0.10),
        'exposureLimitComplement': bonify(1.00),
        'ETH': {
            'qMin': 0.001,
            'pMin': bonify(20),
            'repricerParam1': bonify(1.05),
            'repricerParam2': 0,
        },
        'BTC': {
            'qMin': 0.0001,
            'pMin': bonify(200),
            'repricerParam1': bonify(0.95),
            'repricerParam2': 0,
        },
        'LINK': {
            'qMin': 0.1,
            'pMin': bonify(0.3),
            'repricerParam1': bonify(1.40),
            'repricerParam2': 0,
        },
        'MATIC': {
            'qMin': 1,
            'pMin': bonify(0.02),
            'repricerParam1': bonify(1.50),
            'repricerParam2': 0,
        },
        'COMP': {
            'qMin': 0.01,
            'pMin': bonify(5),
            'repricerParam1': bonify(1.50),
            'repricerParam2': 0,
        },
        'AAVE': {
            'qMin': 0.01,
            'pMin': bonify(5),
            'repricerParam1': bonify(1.50),
            'repricerParam2': 0,
        },
        'UNI': {
            'qMin': 0.1,
            'pMin': bonify(0.3),
            'repricerParam1': bonify(1.50),
            'repricerParam2': 0,
        },
    },
}

const plps = {
    137: {
        'BTCx5-USDC': '0xa51110FF610eC9523dacf13F2bB03e05aFCBc624',
        'ETHx5-USDC': '0xc5ba71C09cB87eea42AD6047b0786F299e61B9f4',
        'MATICx5-USDC': '0xFD4ddD7891E42c3fb2546EDeb1AD6e3461b65bc9',
        'LINKx5-USDC': '0x59616AeAB216dD0F1216d32365cAaA86c84664FB',
        'AAVEx5-USDC': '0x003364f2af300e8BEbf108B90b03aB21b983deAA',
        'COMPx5-USDC': '0x8716637bc05dBAFE19B9C47Fb238095C297405b7',
        'UNIx5-USDC': '0xc35A2E2E83391193fD48aCE12F8cC5AC09297Ff5',
        'CallMATIC': '0x1fD5Bf3B301539CD34Bd8777540F1b321404Cab7',
        'CallWETH': '0x0a9E306327A031e976ab44CF7CC6959Cc1D42d72',
        'CallLINK': '0x0970680203b951206CcC58A50602382760Ad3422',
        'CallUNI': '0x0d2c9286c01B50B3A66417aD00Ac82Ae0aE9C5ab',
        'CallCOMP': '0x5E5d0b44E6e236AAb33DcCa9E03ed450BdB3aE0c',
        'CallAAVE': '0xA5629F1B865f00Ac3361b34920eB7BA5db464ac5',
        'Call_WBTC': '0xE82c4E2ce680B98fC732283d9b42F1994e2f5c7b',
    },
    80001: {
        'BTCx5-USDC': '0x518Af3c9b60dc0D81C60633d618f78DF023325c6',
        'ETHx5-USDC': '0x6936F3a218A3CBaA5b07cCA52DD2C3b0956EC54A',
        'MATICx5-USDC': '0xE3420e6dfbB4ABefDA9127A6EEa64AC898Fa7f7D',
        'CallWBTC': '0x809898E0631A0D8FE03FEfBA63e429D665A3D3CD',
        'CallWETH': '0xAD740C40Fd77030DC0918703881E5CBF7abB83bd',
        'CallWMATIC': '0xe05A1e57848EF62495d775Ed041218E6982510A4',
    }
}

const getType = (symbol) => {
    if(symbol.indexOf('x5') > -1) {
        return 'x5';
    }
    if(symbol.indexOf('Call') > -1) {
        return 'Call';
    }

    throw 'Incorrect derivative symbol' + symbol;
};

const getRepricerSymbol = (type) => {
    switch(type) {
        case 'x5': return 'x5Repricer';
        case 'Call': return 'CallOptionRepricer';
    }
    throw 'Incorrect derivative type' + type;
}

const getFeed = (symbol) => {
    if(symbol.indexOf('BTC') > -1) {
        return 'BTC';
    }
    if(symbol.indexOf('ETH') > -1) {
        return 'ETH';
    }
    if(symbol.indexOf('MATIC') > -1) {
        return 'MATIC';
    }
    if(symbol.indexOf('LINK') > -1) {
        return 'LINK';
    }
    if(symbol.indexOf('AAVE') > -1) {
        return 'AAVE';
    }
    if(symbol.indexOf('COMP') > -1) {
        return 'COMP';
    }
    if(symbol.indexOf('UNI') > -1) {
        return 'UNI';
    }

    throw 'Incorrect derivative symbol' + symbol;
}

const getQMin = (type, feed, collateralTokenDecimals) => decify(FINALIZE_PARAMS[type][type === 'x5' ? 'USDC' : feed]['qMin'], collateralTokenDecimals);

const approveMaxToken = async (tokenContract, toAddress, fromAddress) => await tokenContract.methods.approve(toAddress, MAX).send({ from: fromAddress });

const finalizePool = async (poolContract, networkId, symbol, type, feed, qMin, joinDerivativeAmount, fromAddress) => {
    console.log('Finalize Pool');

    const pMin = FINALIZE_PARAMS[type][type === 'x5' ? 'USDC' : feed]['pMin'];
    console.log("pMin", pMin.toString());

    const plp = plps[networkId][symbol] || '0x0000000000000000000000000000000000000000';

    const exposureLimitPrimary = FINALIZE_PARAMS[type]['exposureLimitPrimary'];
    const exposureLimitComplement = FINALIZE_PARAMS[type]['exposureLimitComplement'];

    const repricerParam1 = FINALIZE_PARAMS[type][feed]['repricerParam1']
    const repricerParam2 = FINALIZE_PARAMS[type][feed]['repricerParam2']

    const alpha = 1;
    const leveragePrimary = bonify(Math.sqrt(alpha));
    const leverageComplement = bonify(Math.sqrt(alpha));

    console.log(
      'Finalize params ',
      plp,
      joinDerivativeAmount.toString(),
      leveragePrimary.toString(),
      joinDerivativeAmount.toString(),
      leverageComplement.toString(),
      exposureLimitPrimary.toString(),
      exposureLimitComplement.toString(),
      pMin.toString(),
      qMin.toString(),
      repricerParam1.toString(),
      repricerParam2.toString()
    );


    await poolContract.finalize(
      plp,
      joinDerivativeAmount,
      leveragePrimary,
      joinDerivativeAmount,
      leverageComplement,
      exposureLimitPrimary,
      exposureLimitComplement,
      pMin,
      qMin,
      repricerParam1,
      repricerParam2,
      { from: fromAddress }
    );
}

const setPoolFee = async (poolContract, type, fromAddress) => {
    console.log('fee ',
      FEE_PARAMS[type]['baseFee'].toString(),
      FEE_PARAMS[type]['maxFee'].toString(),
      FEE_PARAMS[type]['feeAmpPrimary'].toString(),
      FEE_PARAMS[type]['feeAmpComplement'].toString()
    );

    await wait(await poolContract.setFeeParams(
      FEE_PARAMS[type]['baseFee'],
      FEE_PARAMS[type]['maxFee'],
      FEE_PARAMS[type]['feeAmpPrimary'],
      FEE_PARAMS[type]['feeAmpComplement'],
      { from: fromAddress }
    ));
}

module.exports = async (done) => {
    const networkType = await web3.eth.net.getNetworkType();
    const networkId = await web3.eth.net.getId();
    const accounts = await web3.eth.getAccounts();
    console.log('network type:' + networkType);
    console.log('network id:' + networkId);
    console.log('accounts:' + accounts);

    const CONTROLLER = accounts[0];

    let poolFactoryAddress = process.env.POOL_FACTORY;
    if (!poolFactoryAddress) {
        poolFactoryAddress = POOL_FACTORY[networkId];
    }
    const factory = await PoolFactory.at(poolFactoryAddress);
    console.log('poolFactoryAddress ' + factory.address);

    try {
        let vaultFactoryAddress = process.env.VAULT_FACTORY_PROXY_ADDRESS;
        if (!vaultFactoryAddress) {
            vaultFactoryAddress = VAULT_FACTORY_PROXY[networkId];
        }
        const vaultFactory = await VaultFactory.at(vaultFactoryAddress);
        console.log('vaultFactoryAddress ' + vaultFactory.address);

        const newPools = [];
        const vaultIndexes = [await vaultFactory.getLastVaultIndex.call()];

        for (let i = 0; i < vaultIndexes.length; i++) {
            const vaultIndex = vaultIndexes[i];

            console.log(' ');
            console.log('Vault index ' + vaultIndex);
            const vaultAddress = await vaultFactory.getVault.call(vaultIndex);
            console.log('Vault ' + vaultAddress);
            const vaultContract = await Vault.at(vaultAddress);

            const derivativeSpecificationAddress = await vaultContract.derivativeSpecification();
            const derivativeSpecification = await DerivativeSpecification.at(derivativeSpecificationAddress);
            const symbol = await derivativeSpecification.symbol();
            console.log("Specification: ", symbol);
            console.log("Specification address: ", derivativeSpecificationAddress);

            const type = getType(symbol);
            console.log("type: ", type);
            const repricerSymbol = getRepricerSymbol(type);
            console.log("repricerSymbol: ", repricerSymbol);
            const feed = getFeed(symbol);
            console.log("feed: ", feed);


            console.log('Creating pool... for vault ' + vaultAddress + ' and repricer ' + repricerSymbol);
            await wait( await factory.newPool(vaultAddress, web3.utils.keccak256(repricerSymbol), 0, 0, 0));

            const lastPoolIndex = await factory.getLastPoolIndex.call();
            console.log('Pool created index ' + lastPoolIndex);
            const poolAddress = await factory.getPool.call(lastPoolIndex);
            console.log('!!!! Pool created:    ' + poolAddress);
            newPools.push(poolAddress);

            const poolContract = await Pool.at(poolAddress);

            const collateralTokenAddress = await vaultContract.collateralToken();
            const primaryTokenAddress = await vaultContract.primaryToken();
            const complementTokenAddress = await vaultContract.complementToken();

            const collateralToken = new web3.eth.Contract(StubToken.abi, collateralTokenAddress);
            console.log('collateralTokenAddress ', collateralTokenAddress);
            const primaryToken = new web3.eth.Contract(StubToken.abi, primaryTokenAddress);
            console.log('primaryTokenAddress ', primaryTokenAddress);
            const complementToken = new web3.eth.Contract(StubToken.abi, complementTokenAddress);
            console.log('complementTokenAddress ', complementTokenAddress);

            const collateralTokenDecimals = await collateralToken.methods.decimals().call();
            console.log('collateralTokenDecimals', collateralTokenDecimals);

            const qMin = getQMin(type, feed, collateralTokenDecimals);
            console.log('qMin', qMin.toString());

            const qMinMintingMultiplier = type === 'x5' ? 10 : 2;
            const joinDerivativeAmount = qMin.times(qMinMintingMultiplier);
            console.log('join derivative token amount', joinDerivativeAmount.toString());

            const mintMultiplier = type === 'x5' ? 2 : 1;
            const mintAmount = joinDerivativeAmount.times(mintMultiplier);
            console.log('collateral mint amount', mintAmount.toString());

            console.log('Set Pool Fee ');
            await setPoolFee(poolContract, type, CONTROLLER);

            if (networkId !== 1 && networkId !== 137) {
                console.log('Mint test collateral');
                await collateralToken.methods.mint(CONTROLLER, bn(mintAmount)).send({ from: CONTROLLER });
            }

            console.log('Approve collateral to vault');
            await approveMaxToken(collateralToken, vaultAddress, CONTROLLER);

            console.log('Mint derivatives');
            await vaultContract.mint(bn(mintAmount), { from: CONTROLLER, });

            console.log('Approve primary to pool');
            await approveMaxToken(primaryToken, poolContract.address, CONTROLLER);

            console.log('Approve complement to pool');
            await approveMaxToken(complementToken, poolContract.address, CONTROLLER);

            await finalizePool(poolContract, networkId, symbol, type, feed, qMin, joinDerivativeAmount, CONTROLLER);
        }

        console.log(' ');
        console.log('New pools: ', newPools);
    } catch (e) {
        console.log(e);
        done();
    }

    done();
};
