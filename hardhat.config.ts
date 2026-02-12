import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers"
import { defineConfig } from "hardhat/config"

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: ["./src", "./test/utils/mock"],
    tests: "./test/hardhat",
    artifacts: "./out/hardhat",
    cache: "./cache/hardhat",
    ignition: "./test/ignition",
  },
  typechain: {
    outDir: "./out/hardhat/typechain",
  },
  test: {
    mocha: {
      parallel: true,
    },
  },
})
