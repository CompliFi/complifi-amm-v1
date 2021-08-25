// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const fs = require('fs');
const hre = require('hardhat');
const Web3 = require('web3');
const web3 = new Web3('');

const BN = hre.ethers.BigNumber;

async function main() {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }

    // // first iteration
    // const plpAddress = '0x003364f2af300e8BEbf108B90b03aB21b983deAA';
    // const derivativeSpecification = '0x463419221e0d2EF8BC7273e09E42983B57Be06C8';
    // const designatedPoolRegistry = '0x900f8fd2904dc4033e0181E7196dE111A9BC1876';
    // const rolloverStrategy = '0xEfcDCE2d41F35Dfb833D077d6ca9626d69a3C938';
    // const designatedPool = '0xe6eCBf41AD36568Fef15E20C234a949a9a60f4D9';

    // second iteration
    const plpAddress = '0xc35A2E2E83391193fD48aCE12F8cC5AC09297Ff5';
    const derivativeSpecification = '0x68C773Ec08F22F405F82e56a7f86C2f95E20FC4B';
    const designatedPoolRegistry = '0x900f8fd2904dc4033e0181E7196dE111A9BC1876';
    const rolloverStrategy = '0xEfcDCE2d41F35Dfb833D077d6ca9626d69a3C938';
    const designatedPool = '0x798D44D3196F154c8892354FE7f69deb4D5Bf379';

    await hre.run("verify:verify", {
        address: plpAddress,
        constructorArguments: [
            derivativeSpecification,
            designatedPoolRegistry,
            rolloverStrategy,
            designatedPool,
        ]
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
