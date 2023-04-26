const { ethers } = require("hardhat");

const networkConfig = {
  default: {
    name: "hardhat",
    keepersUpdateInterval: "30",
  },
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    entranceFee: ethers.utils.parseEther("0.01"),
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    subscriptionId: "1286",
    callbackGasLimit: "500000",
    interval: "30", //seconds
  },
  31337: {
    name: "localhost",
    entranceFee: ethers.utils.parseEther("0.05"),
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    callbackGasLimit: "500000",
    interval: "30", //seconds
  },
};

const developmentChain = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  developmentChain,
};
