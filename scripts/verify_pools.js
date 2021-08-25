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

    const Pool = await hre.ethers.getContractFactory('Pool');

    const protocolOwner = '0x7A596C2d3e0f390A212a8Ed47308cf621b5E949C';

    const poolAddresses = [
        '0x798D44D3196F154c8892354FE7f69deb4D5Bf379'
    ];

    for (let i = 0; i < poolAddresses.length; i++) {
        const poolAddress = poolAddresses[i];

        console.log('Attach Pool...');
        const pool = await Pool.attach(poolAddress);
        console.log('Attached Pool: ', pool.address);

        const [
          derivativeVault, dynamicFee, repricer, controller
        ] = await Promise.all([
            pool.derivativeVault(),
            pool.dynamicFee(),
            pool.repricer(),
            pool.controller()
        ]);

        const poolController = '0x0000000000000000000000000000000000000000' === controller ? protocolOwner : controller;

        const params = [
            derivativeVault,
            dynamicFee,
            repricer,
            poolController,
        ];

        console.log(params);

        // const paramsEncoded = web3.eth.abi
        //     .encodeParameters(
        //         ['address', 'address', 'address', 'address'],
        //         [derivativeVault, dynamicFee, repricer, poolController]
        //     )
        //     .replace('0x', '');
        //
        // console.log(
        //     `truffle run verify Pool@${pool.address} --forceConstructorArgs string:${paramsEncoded} --network=matic_mainnet ` //--debug
        // );

        await hre.run("verify:verify", {
          address: poolAddress,
          constructorArguments: [
            derivativeVault,
            dynamicFee,
            repricer,
            poolController
          ]
        });
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
