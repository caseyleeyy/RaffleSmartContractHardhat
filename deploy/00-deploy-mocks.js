const { network } = require("hardhat");

const { developmentChain } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25"); //premium cost - min link cost needed per request
const GAS_PRICE_LINK = 1e9; //calculated link val based on gas price of chain

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChain.includes(network.name)) {
    log("Local network detected, deploying mock chainlink contracts....");

    //deploy mock vrfcoordinator
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args /* check constructor to see what arguments are needed */,
    });

    log("Mocks deployed!");
    log("-------------------------------------------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
