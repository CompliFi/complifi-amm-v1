import { ethers, waffle } from 'hardhat';
import { BigNumberish } from '@ethersproject/bignumber';

const { BigNumber, constants } = ethers;
const bn = (value: any) => BigNumber.from(value);

const { deployMockContract } = waffle;
const provider = waffle.provider; //MockProvider
const [wallet, otherWallet] = provider.getWallets();

import chai from 'chai';

import Vault from '../abi/Vault.json';
import Oracle from '../abi/Oracle.json';
import DerivativeSpecification from '../abi/DerivativeSpecification.json';

import { X5Repricer } from '../../typechain/X5Repricer';

const { expect } = chai;

const mockVault = async (currentTime: any, currentUnderlingValue: any, settledTime: any) => {
    const mockDerivativeSpecification = await deployMockContract(
        wallet,
        DerivativeSpecification.abi
    );
    await mockDerivativeSpecification.mock.primaryNominalValue.returns(1);
    await mockDerivativeSpecification.mock.complementNominalValue.returns(1);

    const mockOracle = await deployMockContract(wallet, Oracle.abi);
    await mockOracle.mock.latestRoundData.returns(
        1,
        currentUnderlingValue,
        0,
        currentTime - 1 * 60,
        0
    );

    const mockVault = await deployMockContract(wallet, Vault.abi);
    await mockVault.mock.derivativeSpecification.returns(mockDerivativeSpecification.address);
    await mockVault.mock.oracles.withArgs(0).returns(mockOracle.address);
    await mockVault.mock.settleTime.returns(settledTime);

    return mockVault.address;
};

const createPoolPair = (balance: any, leverage: any): [BigNumberish, BigNumberish] => {
    const BONE = Math.pow(10, 18).toString();
    const collateralTokenDecimals = 6;

    return [
        bn(balance).mul(10 ** collateralTokenDecimals),
        bn(leverage * 10)
            .mul(BONE)
            .div(10),
    ];
};

const getBlockTime = async (provider: any) => {
    const block = await provider.getBlock();
    return block.timestamp;
};

describe('x5Repricer', () => {
    let repricer: X5Repricer;

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        const x5RepricerFactory = await ethers.getContractFactory('x5Repricer', signers[0]);
        repricer = (await x5RepricerFactory.deploy()) as X5Repricer;
        await repricer.deployed();
        expect(repricer.address).to.properAddress;
    });

    it('check read params', async () => {
        await expect(await repricer.isRepricer()).to.be.true;
        await expect(await repricer.symbol()).to.be.equal('x5Repricer');
    });

    it('reprice with 1% change', async () => {
        const currentTime = await getBlockTime(provider);
        const settledTime = currentTime + 30 * 24 * 60 * 60;
        const pMin = 0.01;
        const volatility = 1;

        const liveUnderlingValue = 1000;
        const change = 0.01;
        const currentUnderlingValue = change * liveUnderlingValue + liveUnderlingValue;

        const primaryBalance = 10000;
        const primaryLeverage = 1.1;

        const complementBalance = 10000;
        const complementLeverage = 9;

        const vault = await mockVault(currentTime, currentUnderlingValue, settledTime);

        const result = await repricer.reprice(
            (pMin * Math.pow(10, 18)).toString(),
            (volatility * Math.pow(10, 18)).toString(),
            vault,
            createPoolPair(primaryBalance, primaryLeverage),
            createPoolPair(complementBalance, complementLeverage),
            liveUnderlingValue
        );

        await expect(result['newPrimaryLeverage']).to.be.equal('3353798460089693582');
        await expect(result['newComplementLeverage']).to.be.equal('2951876839890741554');
        await expect(result['estPricePrimary']).to.be.equal('936260336767890035');
        await expect(result['estPriceComplement']).to.be.equal('1063739663232109965');
    });

    it('reprice with 10% change', async () => {
        const currentTime = await getBlockTime(provider);
        const settledTime = currentTime + 30 * 24 * 60 * 60;
        const pMin = 0.01;
        const volatility = 1;

        const liveUnderlingValue = 1000;
        const change = 0.1;
        const currentUnderlingValue = change * liveUnderlingValue + liveUnderlingValue;

        const primaryBalance = 10000;
        const primaryLeverage = 1.1;

        const complementBalance = 10000;
        const complementLeverage = 9;

        const vault = await mockVault(currentTime, currentUnderlingValue, settledTime);

        const result = await repricer.reprice(
            (pMin * Math.pow(10, 18)).toString(),
            (volatility * Math.pow(10, 18)).toString(),
            vault,
            createPoolPair(primaryBalance, primaryLeverage),
            createPoolPair(complementBalance, complementLeverage),
            liveUnderlingValue
        );

        await expect(result['newPrimaryLeverage']).to.be.equal('2692398236387031954');
        await expect(result['newComplementLeverage']).to.be.equal('3677019196567649243');
    });

    it('reprice with 20% change', async () => {
        const currentTime = await getBlockTime(provider);
        const settledTime = currentTime + 30 * 24 * 60 * 60;
        const pMin = 0.01;
        const volatility = 1;

        const liveUnderlingValue = 1000;
        const change = 0.2;
        const currentUnderlingValue = change * liveUnderlingValue + liveUnderlingValue;

        const primaryBalance = 10000;
        const primaryLeverage = 1.1;

        const complementBalance = 10000;
        const complementLeverage = 9;

        const vault = await mockVault(currentTime, currentUnderlingValue, settledTime);

        const result = await repricer.reprice(
            (pMin * Math.pow(10, 18)).toString(),
            (volatility * Math.pow(10, 18)).toString(),
            vault,
            createPoolPair(primaryBalance, primaryLeverage),
            createPoolPair(complementBalance, complementLeverage),
            liveUnderlingValue
        );

        await expect(result['newPrimaryLeverage']).to.be.equal('2144451316141264140');
        await expect(result['newComplementLeverage']).to.be.equal('4616565517474235280');
    });

    it('reprice with 100% change', async () => {
        const currentTime = await getBlockTime(provider);
        const settledTime = currentTime + 30 * 24 * 60 * 60;
        const pMin = 0.01;
        const volatility = 1;

        const liveUnderlingValue = 1000;
        const change = 1;
        const currentUnderlingValue = change * liveUnderlingValue + liveUnderlingValue;

        const primaryBalance = 10000;
        const primaryLeverage = 1.1;

        const complementBalance = 10000;
        const complementLeverage = 9;

        const vault = await mockVault(currentTime, currentUnderlingValue, settledTime);

        const result = await repricer.reprice(
            (pMin * Math.pow(10, 18)).toString(),
            (volatility * Math.pow(10, 18)).toString(),
            vault,
            createPoolPair(primaryBalance, primaryLeverage),
            createPoolPair(complementBalance, complementLeverage),
            liveUnderlingValue
        );

        await expect(result['newPrimaryLeverage']).to.be.equal('404941117447956870');
        await expect(result['newComplementLeverage']).to.be.equal('24447998914983856599');
    });

    it('reprice with -10% change', async () => {
        const currentTime = await getBlockTime(provider);
        const settledTime = currentTime + 30 * 24 * 60 * 60;
        const pMin = 0.01;
        const volatility = 1;

        const liveUnderlingValue = 1000;
        const change = -0.1;
        const currentUnderlingValue = change * liveUnderlingValue + liveUnderlingValue;

        const primaryBalance = 10000;
        const primaryLeverage = 1.1;

        const complementBalance = 10000;
        const complementLeverage = 9;

        const vault = await mockVault(currentTime, currentUnderlingValue, settledTime);

        const result = await repricer.reprice(
            (pMin * Math.pow(10, 18)).toString(),
            (volatility * Math.pow(10, 18)).toString(),
            vault,
            createPoolPair(primaryBalance, primaryLeverage),
            createPoolPair(complementBalance, complementLeverage),
            liveUnderlingValue
        );

        await expect(result['newPrimaryLeverage']).to.be.equal('4524617626485137583');
        await expect(result['newComplementLeverage']).to.be.equal('2188030197745267838');
    });
});

// describe('BasicToken', () => {
//     const [wallet, walletTo] = new MockProvider().getWallets();
//     let token: Contract;
//
//     beforeEach(async () => {
//         token = await deployContract(wallet, BasicToken, [1000]);
//     });
//
//     it('Assigns initial balance', async () => {
//         expect(await token.balanceOf(wallet.address)).to.equal(1000);
//     });
//
//     it('Transfer adds amount to destination account', async () => {
//         await token.transfer(walletTo.address, 7);
//         expect(await token.balanceOf(walletTo.address)).to.equal(7);
//     });
//
//     it('Transfer emits event', async () => {
//         await expect(token.transfer(walletTo.address, 7))
//             .to.emit(token, 'Transfer')
//             .withArgs(wallet.address, walletTo.address, 7);
//     });
//
//     it('Can not transfer above the amount', async () => {
//         await expect(token.transfer(walletTo.address, 1007)).to.be.reverted;
//     });
//
//     it('Can not transfer from empty account', async () => {
//         const tokenFromOtherWallet = token.connect(walletTo);
//         await expect(tokenFromOtherWallet.transfer(wallet.address, 1))
//             .to.be.reverted;
//     });
//
//     it('Calls totalSupply on BasicToken contract', async () => {
//         await token.totalSupply();
//         expect('totalSupply').to.be.calledOnContract(token);
//     });
//
//     it('Calls balanceOf with sender address on BasicToken contract', async () => {
//         await token.balanceOf(wallet.address);
//         expect('balanceOf').to.be.calledOnContractWith(token, [wallet.address]);
//     });
// });
