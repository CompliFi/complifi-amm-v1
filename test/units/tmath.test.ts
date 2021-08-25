import { ethers, waffle } from 'hardhat';
import chai from 'chai';

import { TMath } from '../../typechain/TMath';

const { BigNumber, constants } = ethers;

const { expect } = chai;

const BONE = BigNumber.from(10).pow(26);

const mul = (a: any, b: any) => {
    const c0 = BigNumber.from(a).mul(b);
    const c1 = c0.add(BONE.div(2));
    return c1.div(BONE);
}

const div = (a: any, b: any) => {
    const c0 = BigNumber.from(a).mul(BONE);
    const c1 = c0.add(BigNumber.from(b).div(2));
    return c1.div(BigNumber.from(b));
}

const random100 = () => {
    return Math.floor(Math.random() * 100) + 1;
}

describe('Math', () => {
    let tmath: TMath;

    before(async () => {
        const signers = await ethers.getSigners();
        const tmathFactory = await ethers.getContractFactory('TMath', signers[0]);
        tmath = (await tmathFactory.deploy()) as TMath;
        await tmath.deployed();
        expect(tmath.address).to.properAddress;
    });

    it('add throws on overflow', async () => {
        await expect(tmath.calc_add(BigNumber.from('1'), constants.MaxUint256)).to.be.revertedWith(
            'ADD_OVERFLOW'
        );
    });

    it('sub throws on underflow', async () => {
        await expect(tmath.calc_sub(1, 2)).to.be.revertedWith('SUB_UNDERFLOW');
    });

    it('mul throws on overflow', async () => {
        await expect(tmath.calc_mul(2, constants.MaxUint256)).to.be.revertedWith('MUL_OVERFLOW');
    });

    it('div throws on div by 0', async () => {
        await expect(tmath.calc_div(1, 0)).to.be.revertedWith('DIV_ZERO');
    });

    it('mul error token decimals 18 1', async () => {
        let poolTotal = (8.57 * 10**18).toString(); // 8.57
        let poolAmountOut = BigNumber.from(10**12).mul((10**18).toString()); // 5
        let poolTokenTotal = (8.57 * 10**18).toString(); // 8.57
        let ratio = await tmath.calc_div(poolAmountOut, poolTotal);
        await expect(ratio).to.be.equal(div(poolAmountOut, poolTotal));

        let value = await tmath.calc_mul(ratio, poolTokenTotal);
        await expect(value).to.be.equal('1000000000000000000000000000000');
    });

    it('mul error token decimals 18 2', async () => {
        let poolTotal = (804 * 10**18).toString(); // 804
        let poolAmountOut = BigNumber.from(10**12).mul((10**18).toString()); // 500
        let poolTokenTotal = (402 * 10**18).toString(); // 402
        let ratio = await tmath.calc_div(poolAmountOut, poolTotal);
        await expect(ratio).to.be.equal(div(poolAmountOut, poolTotal));

        let value = await tmath.calc_mul(ratio, poolTokenTotal);
        await expect(value).to.be.equal('500000000000000000000000000000');
    });

    it('mul error token decimals 18 3', async () => {
        let poolTotalBig = BigNumber.from(1040).mul((10**18).toString());
        let poolAmountOutBig = BigNumber.from(10**12).mul((10**18).toString());
        let poolTokenTotalBig = BigNumber.from(520).mul((10**18).toString());
        let ratio = await tmath.calc_div(poolAmountOutBig, poolTotalBig);
        await expect(ratio).to.be.equal(div(poolAmountOutBig, poolTotalBig));

        let value = await tmath.calc_mul(ratio, poolTokenTotalBig);
        await expect(value).to.be.equal('500000000000000000000000000000');
    });

    it('mul error token decimals 18 4', async () => {
        let poolTotalBig = BigNumber.from(2040).mul((10**18).toString());
        let poolAmountOutBig = BigNumber.from(10**12).mul((10**18).toString());
        let poolTokenTotalBig = BigNumber.from(1020).mul((10**18).toString());
        let ratio = await tmath.calc_div(poolAmountOutBig, poolTotalBig);
        await expect(ratio).to.be.equal('49019607843137254901960784313725490'); // div(poolAmountOutBig, poolTotalBig)

        let value = await tmath.calc_mul(ratio, poolTokenTotalBig);
        //await expect(BigNumber.from(ratio).mul(poolTokenTotalBig).div(BONE)).to.be.equal('500000000000000000000000');
        await expect(value).to.be.equal('500000000000000000000000000000');
    });

    it('mul error token decimals 6 2', async () => {
        let poolTotalBig = BigNumber.from(2040).mul((10**18).toString());
        let poolAmountOutBig = BigNumber.from(10**12).mul((10**18).toString());
        let poolTokenTotalBig = BigNumber.from(1020).mul((10**6).toString());
        const ratio = await tmath.calc_div(poolAmountOutBig, poolTotalBig);
        await expect(ratio).to.be.equal('49019607843137254901960784313725490');

        const value = await tmath.calc_mul(ratio, poolTokenTotalBig);
        await expect(value).to.be.equal('500000000000000000');
    });

    it('mul error token decimals 6 1', async () => {
        const poolTotal = (8.57 * 10**18).toString(); // 8.57
        const poolAmountOut = (5 * 10**18).toString(); // 5
        const poolTokenTotal = (8.57 * 10**6).toString(); // 8.57
        const ratio = await tmath.calc_div(poolAmountOut, poolTotal);
        await expect(ratio).to.be.equal(div(poolAmountOut, poolTotal));

        const value = await tmath.calc_mul(ratio, poolTokenTotal);
        await expect(value).to.be.equal(mul(ratio, poolTokenTotal));
    });

    // it('mul error for many tries', async () => {
    //     let poolTotal = (1 * 10**18).toString();
    //     let poolAmountOut = (0.2 * 10**18).toString();
    //     let poolTokenTotal = (0.5 * 10**18).toString();
    //     const rounds = 5000;
    //     for (let i = 0; i < rounds; i++) {
    //         poolTotal = (Number(poolTotal) + random100()).toString();
    //         poolAmountOut = (Number(poolAmountOut) + random100()).toString()
    //         poolTokenTotal =(Number(poolTokenTotal) + random100()).toString()
    //         const ratio = await tmath.calc_div(poolAmountOut, poolTotal);
    //         await expect(ratio).to.be.equal(div(poolAmountOut, poolTotal));
    //
    //         const value = await tmath.calc_mul(ratio, poolTokenTotal);
    //         await expect(value).to.be.equal(mul(ratio, poolTokenTotal));
    //     }
    //
    // })
});
