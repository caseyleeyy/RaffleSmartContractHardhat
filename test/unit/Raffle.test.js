const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const {
  developmentChain,
  networkConfig,
} = require("../../helper-hardhat-config");

//unit tests only on dev chains not testnet
!developmentChain.includes(network.name)
  ? describe.skip
  : describe("Raffle unit test", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );

        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });

      describe("raffle constructor", function () {
        it("initializes the raffle correctly", async function () {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0"); //enum 0
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enter raffle", function () {
        it("reverts transaction when don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
            raffle,
            "Raffle__NotEnoughEthEntered"
          );
        });

        it("records players when enter raffle", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("emits raffle event on enter raffle", async function () {
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, "RaffleEnter");
        });

        it("unable to enter raffle when calculating winner state", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          // another way to call using network.provider.request instead of send:
          // await network.provider.request({ method: "evm_mine", params: [] });
          await network.provider.send("evm_mine", []);

          //invoke chainlink keeper function - simulate a perform upkeep
          await raffle.performUpkeep([]);
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpenState");
        });
      });

      describe("checkUpkeep functions", function () {
        it("returns false if no user sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);

          //simulate sending a transaction and seeing response (instead of sending one when calling checkUpkeep)
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if raffle is not open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          //can use either "0x" or [] to send a blank bytes object
          await raffle.performUpkeep("0x");
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), "1"); //enum 1 is CALCULATING_WINNER
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed to checkUpkeep", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ]); // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep functions", function () {
        it("only run if checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });

        it("reverts with Raffle__UpkeepNotNeeded when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWithCustomError(
            raffle,
            "Raffle__UpkeepNotNeeded"
          );
        });

        it("updates raffle state, emits event, and calls vrfcoordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(requestId.toNumber() > 0);
          assert(raffleState.toString() == "1");
        });
      });

      describe("fulfillRandomWords function", function () {
        beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });

        it("only called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) //fulfillRandomWords(requestId, consumer address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request");
        });

        it("picks a winner, resets lottery, sends money", async function () {
          //additional people entering the raffle
          const additionalEntrants = 3;
          const startingAccIndex = 1; //deployer = 0
          const accounts = await ethers.getSigners();

          for (
            let i = startingAccIndex;
            i < startingAccIndex + additionalEntrants;
            i++
          ) {
            const accountConnectedRaffle = raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({
              value: raffleEntranceFee,
            });
          }

          const startingTimeStamp = await raffle.getLatestTimeStamp();

          //performUpkeep - pretend to be chainlink keeper
          //fulfillRandomWords - pretend to be chainlink vrf
          //simultate waiting for fulfillRandomWords to be called
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("winnerpicked event emitted");

              try {
                const recentWinner = await raffle.getRecentWinner();
                console.log(`winner: ${recentWinner}`);
                const raffleState = await raffle.getRaffleState();
                const endingTimestamp = await raffle.getLatestTimeStamp();
                const numPlayers = await raffle.getPlayersNo();
                const winnerEndingBalance = await accounts[1].getBalance();

                // s_players array has been reset to 0
                assert.equal(numPlayers.toString(), "0");
                // raffleState is open
                assert.equal(raffleState.toString(), "0");
                assert(endingTimestamp > startingTimeStamp);

                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(
                    raffleEntranceFee
                      .mul(additionalEntrants)
                      .add(raffleEntranceFee)
                      .toString()
                  )
                );
              } catch (err) {
                reject(err);
              }
              resolve();
            });

            //setting up listener
            //fire chainlink events for listener to pick up and resolve
            const tx = await raffle.performUpkeep([]);
            const txReceipt = await tx.wait(1);
            const winnerStartingBalance = await accounts[1].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
