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

    const PoolFactory = await hre.ethers.getContractFactory('PoolFactory');

    const poolFactoryAddress = '0xa7E039A7984834562F8a1CB19cB7fc5819417225';

    console.log('Attach PoolFactory...');
    const poolFactory = await PoolFactory.attach(poolFactoryAddress);
    console.log('Attached PoolFactory: ', poolFactory.address);

    const [
        poolBuilder, dynamicFee, repricerRegistry
    ] = await Promise.all([
        poolFactory._poolBuilder(),
        poolFactory._dynamicFee(),
        poolFactory._repricerRegistry(),
    ]);

    const params = [
        poolBuilder,
        dynamicFee,
        repricerRegistry
    ];

    console.log(params);

    // const paramsEncoded = web3.eth.abi
    //     .encodeParameters(
    //         ['address', 'address', 'address'],
    //         [poolBuilder, dynamicFee, repricerRegistry]
    //     )
    //     .replace('0x', '');
    //
    // console.log(
    //     `truffle run verify PoolFactory@${poolFactoryAddress} --forceConstructorArgs string:${paramsEncoded} --network=matic_mainnet ` //--debug
    // );

    await hre.run("verify:verify", {
        address: poolFactoryAddress,
        constructorArguments: [
            poolBuilder,
            dynamicFee,
            repricerRegistry
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
