const { run } = require("hardhat");

//auto verify code on etherscan
async function verify(contractAddress, args) {
  console.log("verifying contract...");

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("contract already verified");
    } else {
      console.log(e);
    }
  }
}

module.exports = { verify };
