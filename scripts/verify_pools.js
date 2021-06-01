// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const fs = require('fs');
const hre = require("hardhat");
const Web3 = require('web3');
const web3 = new Web3('');

const BN = hre.ethers.BigNumber;

async function main() {

  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }

  const Pool = await hre.ethers.getContractFactory("Pool");

  const poolController = "0x7A596C2d3e0f390A212a8Ed47308cf621b5E949C";

  const poolAddresses = [
    "0x3eAd43ca1ED431446841e75400215937E2a91Acc",
    "0xbfB68BedFE44E5a27B5b3931e20ab389D5928405",
    "0x2786f6C09f7732681B857216c07C424a6e47e12a",
    "0xF9444D2411669E47B1e46760d85C45EAc9694884"
  ];

  for (let i = 0; i < poolAddresses.length; i++) {
    const poolAddress = poolAddresses[i];

    console.log("Attach Pool...");
    const pool = await Pool.attach(poolAddress);
    console.log("Attached Pool: ", pool.address);

    const derivativeVault = await pool.derivativeVault();
    const dynamicFee = await pool.dynamicFee();
    const repricer = await pool.repricer();
    const baseFee = (await pool.baseFee()).toString();
    const maxFee = (await pool.maxFee()).toString();
    const feeAmp = (await pool.feeAmp()).toString();

    const params = [
      derivativeVault,
      dynamicFee,
      repricer,
      baseFee,
      maxFee,
      feeAmp,
      poolController
    ];

    console.log(params);

    const paramsEncoded = web3.eth.abi.encodeParameters(['address','address','address','uint256','uint256','uint256','address'], [
      derivativeVault,
      dynamicFee,
      repricer,
      baseFee,
      maxFee,
      feeAmp,
      poolController
    ]).replace('0x','');

    console.log(`truffle run verify Pool@${pool.address} --forceConstructorArgs string:${paramsEncoded} --network=mainnet --debug`);

    // await hre.run("verify:verify", {
    //   address: poolAddress,
    //   constructorArguments: [
    //     derivativeVault,
    //     dynamicFee,
    //     repricer,
    //     baseFee,
    //     maxFee,
    //     feeAmp,
    //     poolController
    //   ]
    // });
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
