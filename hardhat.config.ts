import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-ganache";

import "hardhat-gas-reporter";

import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { HardhatUserConfig } from "hardhat/types";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async () => {
//   const accounts = await ethers.getSigners();
//
//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
    },
  },
  // etherscan: {
  //   // Your API key for Etherscan
  //   // Obtain one at https://etherscan.io/
  //   apiKey: ETHERSCAN_API_KEY,
  // },
};

export default config;


