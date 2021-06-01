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

    const baseFee = 0.05;
    const maxFee = 0.25;
    const feeAmp = 10;

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        const dynamicFeeFactory = await ethers.getContractFactory('DynamicFee', signers[0]);
        dynamicFee = (await dynamicFeeFactory.deploy()) as DynamicFee;
        await dynamicFee.deployed();
        expect(dynamicFee.address).to.properAddress;
    });

    it('test calcSpotFee simple', async () => {
        const result = dynamicFee.calcSpotFee(
            calculateExpStart(1000, 900).toString(),
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect(await result).to.be.equal('250000000000000000');
    });

    it('calcSpotFee zero exp start', async () => {
        const result = dynamicFee.calcSpotFee(
            calculateExpStart(1000, 1000).toString(),
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect(await result).to.be.equal('50000000000000000');
    });

    it('calcSpotFee huge balance difference with bigger max fee', async () => {
        const result = dynamicFee.calcSpotFee(
            calculateExpStart(1000000, 100).toString(),
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * 10 * BONE).toString()
        );
        expect(await result).to.be.equal('2500000000000000000');
    });

    it('calcSpotFee negative balance difference', async () => {
        const result = dynamicFee.calcSpotFee(
            calculateExpStart(900, 1000).toString(),
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect(await result).to.be.equal('25000000000000000');
    });

    it('calc test simple', async () => {
        const result = dynamicFee.calc(
            [1000, 1, 100],
            [1000, 1, 100],
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect((await result).fee).to.be.equal('250000000000000000');
        expect((await result).expStart).to.be.equal(calculateExpStart(1000, 1000));
    });

    it('calc test big difference in amount', async () => {
        const result = dynamicFee.calc(
            [1000, 1, 100],
            [1000, 1, 1],
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect((await result).fee).to.be.equal('250000000000000000');
        expect((await result).expStart).to.be.equal(calculateExpStart(1000, 1000));
    });

    it('calc test small amount', async () => {
        const result = dynamicFee.calc(
            [1000000, 9, 1],
            [1000000, 1, 1],
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect((await result).fee).to.be.equal('250000000000000000');
        expect((await result).expStart).to.be.equal(calculateExpStart(1000000, 1000000));
    });

    it('calc test small amount big balance diff', async () => {
        const result = dynamicFee.calc(
            [1000000, 9, 1],
            [100, 1, 1],
            (baseFee * BONE).toString(),
            (feeAmp * BONE).toString(),
            (maxFee * BONE).toString()
        );
        expect((await result).fee).to.be.equal('250000000000000000');
        expect((await result).expStart).to.be.equal('999800019998000199');
    });
});
