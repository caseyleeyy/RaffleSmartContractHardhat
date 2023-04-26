const { network, ethers } = require("hardhat");
const { developmentChain, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMT = ethers.utils.parseEther("10");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Mock, vrfCoordinatorV2Addr, subscriptionId;

  if (developmentChain.includes(network.name)) {
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Addr = vrfCoordinatorV2Mock.address;

    //to create subscription programatically and get subscriptionId
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId;

    //fund scription - usually needs link on testnet and mainnet, but mock allows custom setting of this value
    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUB_FUND_AMT
    );
  } else {
    vrfCoordinatorV2Addr = networkConfig[chainId]["vrfCoordinatorV2"];

    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  /**
   * address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subId,
        uint32 callbackGasLimit,
        uint256 interval
   */

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  const args = [
    vrfCoordinatorV2Addr,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.waitConfirmations || 1,
  });

  if (developmentChain.includes(network.name)) {
    await vrfCoordinatorV2Mock.addConsumer(
      subscriptionId.toNumber(),
      raffle.address
    );
  }

  if (
    !developmentChain.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("verifying contract...");
    await verify(raffle.address, args);
  }

  log("---------------------------------");
};

module.exports.tags = ["all", "raffle"];
