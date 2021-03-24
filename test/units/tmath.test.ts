import { ethers, waffle } from "hardhat";
import chai from "chai";

import { TMath } from "../../typechain/TMath";

const { BigNumber, constants } = ethers;

const { expect } = chai;

describe("Math", () => {
    let tmath: TMath;

    before(async () => {
        const signers = await ethers.getSigners();
        const tmathFactory = await ethers.getContractFactory(
            "TMath",
            signers[0]
        );
        tmath = (await tmathFactory.deploy()) as TMath;
        await tmath.deployed();
        expect(tmath.address).to.properAddress;
    });

    it('add throws on overflow', async () => {
        await expect(tmath.calc_add(BigNumber.from("1"), constants.MaxUint256)).to.be.revertedWith("ADD_OVERFLOW");
    });

    it('sub throws on underflow', async () => {

        await expect(tmath.calc_sub(1, 2)).to.be.revertedWith( 'SUB_UNDERFLOW');
    });

    it('mul throws on overflow', async () => {
        await expect(tmath.calc_mul(2, constants.MaxUint256)).to.be.revertedWith( 'MUL_OVERFLOW');
    });

    it('div throws on div by 0', async () => {
        await expect(tmath.calc_div(1, 0)).to.be.revertedWith( 'DIV_ZERO');
    });

    it('pow throws on base outside range', async () => {
        await expect(tmath.calc_pow(0, 2)).to.be.revertedWith( 'POW_BASE_TOO_LOW');
        await expect(tmath.calc_pow(constants.MaxUint256, 2)).to.be.revertedWith( 'POW_BASE_TOO_HIGH');
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
