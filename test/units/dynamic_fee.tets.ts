import { ethers, waffle } from 'hardhat';
import { BigNumberish } from '@ethersproject/bignumber';
import chai from 'chai';
import { DynamicFee } from '../../typechain/DynamicFee';

const { BigNumber, constants } = ethers;
const bn = (value: any) => BigNumber.from(value);

const { expect } = chai;

const BONE = Math.pow(10, 18);

const calculateExpStart = (inBalance: any, outBalance: any): BigNumberish => {
    return ((inBalance - outBalance) / (inBalance + outBalance)) * BONE;
};

describe('DynamicFee', () => {
    let dynamicFee: DynamicFee;

    const baseFee = (0.005 * BONE).toString();
    const maxFee = (0.25 * BONE).toString();
    const feeAmp = (10 * BONE).toString();
    //const feeAmp = 10;

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        const dynamicFeeFactory = await ethers.getContractFactory('DynamicFee', signers[0]);
        dynamicFee = (await dynamicFeeFactory.deploy()) as DynamicFee;
        await dynamicFee.deployed();
        expect(dynamicFee.address).to.properAddress;
    });

    it('calc test simple', async () => {
        const balanceIn = 100 * 10**6;
        const leverageIn = (1 * BONE).toString();
        const amountIn = 1 *  10**6;

        const balanceOut = 100 * 10**6;
        const leverageOut = (1 * BONE).toString();
        const amountOut =    0.990099 *  10**6;

        const result = dynamicFee.calc(
            [balanceIn, leverageIn, amountIn],
            [balanceOut, leverageOut, amountOut],
            baseFee,
            feeAmp,
            maxFee
        );
        expect((await result).fee).to.be.equal('5330008494199985');
        expect((await result).expStart).to.be.equal(calculateExpStart(balanceIn, balanceOut));
    });

    it('calc test big difference in amount', async () => {
        const balanceIn = 1000 * 10**6;
        const leverageIn = (1 * BONE).toString();
        const amountIn = 100 *  10**6;

        const balanceOut = 1000 * 10**6;
        const leverageOut = (1 * BONE).toString();
        const amountOut =  90.90909 *  10**6;

        const result = dynamicFee.calc(
            [balanceIn, leverageIn, amountIn],
            [balanceOut, leverageOut, amountOut],
            baseFee,
            feeAmp,
            maxFee
        );
        expect((await result).fee).to.be.equal('35097663534114428');
        expect((await result).expStart).to.be.equal(calculateExpStart(balanceIn, balanceOut));
    });

    it('calc test small amount', async () => {
        const balanceIn = 1000000 * 10**6;
        const leverageIn = (9 * BONE).toString();
        const amountIn = 1 *  10**6;

        const balanceOut = 1000000 * 10**6;
        const leverageOut = (1 * BONE).toString();
        const amountOut =   0.110555 *  10**6;

        const result = dynamicFee.calc(
            [balanceIn, leverageIn, amountIn],
            [balanceOut, leverageOut, amountOut],
            baseFee,
            feeAmp,
            maxFee
        );
        expect((await result).fee).to.be.equal('5000000000000000');
        expect((await result).expStart).to.be.equal(calculateExpStart(balanceIn, balanceOut));
    });

    it('calc test small amount big balance diff', async () => {
        const balanceIn = 1000000 * 10**6;
        const leverageIn = (9 * BONE).toString();
        const amountIn = 1000 *  10**6;

        const balanceOut = 100 * 10**6;
        const leverageOut = (1 * BONE).toString();
        const amountOut =    0.008332 *  10**6;

        const result = dynamicFee.calc(
            [balanceIn, leverageIn, amountIn],
            [balanceOut, leverageOut, amountOut],
            baseFee,
            feeAmp,
            maxFee
        );
        expect((await result).fee.toString()).to.be.equal('250000000000000000');
        expect((await result).expStart.toString()).to.be.equal( '999800019998000199'); //calculateExpStart(balanceIn, balanceOut));
    });

    it('calc test small amount big balance diff leverages', async () => {
        const balanceIn = 100 * 10**6;
        const leverageIn = (9 * BONE).toString();
        const amountIn = 10 *  10**6;

        const balanceOut = 10000 * 10**6;
        const leverageOut = (1 * BONE).toString();
        const amountOut =     109.890109 *  10**6;

        const result = dynamicFee.calc(
            [balanceIn, leverageIn, amountIn],
            [balanceOut, leverageOut, amountOut],
            baseFee,
            feeAmp,
            maxFee
        );
        expect((await result).fee.toString()).to.be.equal('5000000000000000');
        expect((await result).expStart.toString()).to.be.equal( '-980198019801980198');//calculateExpStart(balanceIn, balanceOut));
    });
});
