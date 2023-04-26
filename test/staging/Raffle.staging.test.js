const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const {
  developmentChain,
  networkConfig,
} = require("../../helper-hardhat-config");

//unit tests only on dev chains not testnet
developmentChain.includes(network.name)
  ? describe.skip
  : describe("Raffle unit test", function () {
      let raffle, raffleEntranceFee, deployer;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract("Raffle", deployer);

        raffleEntranceFee = await raffle.getEntranceFee();
      });

      describe("end to end test", function () {
        it("works with live chainlink keepers and vrf", async function () {
          const startingTimestamp = await raffle.getLatestTimeStamp();
          const accounts = await ethers.getSigners();

          //set up listener before entering raffle
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event emitted");
              resolve();
              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance = await accounts[0].getBalance(); //deployer acc
                const endingTimestamp = await raffle.getLatestTimeStamp();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState, 0);
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(raffleEntranceFee).toString()
                );
                assert(endingTimestamp > startingTimestamp);
                resolve();
              } catch (err) {
                console.log(err);
                reject(err);
              }
            });

            await raffle.enterRaffle({ value: raffleEntranceFee });
            const winnerStartingBalance = await accounts[0].getBalance();
          });
        });
      });
    });
