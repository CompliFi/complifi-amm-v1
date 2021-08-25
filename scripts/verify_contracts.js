// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat');

async function main() {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }

    const contractAddresses = [
        '0x0ebDC66d6FDfa6316a0Fb1cF8322f3AC097Dff16',
        '0x1571deb458FB07001cF47040A234984381ab5752',
        '0x17203208124Add7a86c0dA25ff05d190AEaF024A',
        '0x5e87E5510eB2bbE8c78f4e4582F44f2e048236c9',
        '0xf9BABC9490D665dA3b68194CC49101b3798F89c1',

        '0x900f8fd2904dc4033e0181E7196dE111A9BC1876',
        '0xdcef2e1B1b182435d9bdA48E4063a2bf37E03373',
        //'0xEfcDCE2d41F35Dfb833D077d6ca9626d69a3C938', // Rollover Strategy - commit 22313198a95f07c023631e4c76451c40eb22da3c
    ];

    for (let i = 0; i < contractAddresses.length; i++) {
        const contractsAddress = contractAddresses[i];

        console.log('Verifying contract ' + contractsAddress);

        await hre.run("verify:verify", {
          address: contractsAddress
        });

        // PoolBuilder verified by truffle
        // truffle run verify PoolBuilder@0x5661132921e5D77Fb612508335b179Fa534a1606 --network=matic_mainnet
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
