//steps:
//Enter the lottery - pay some coin
//Pick a random winner - verifiably random
//winner to be selected every x amount of time - completely automated

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

//coordinater does rdm no verification
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Raffle__NotEnoughEthEntered();
error Raffle__NotOpenState();
error Raffle__UpkeepNotNeeded(
    uint256 currBalance,
    uint256 noOfPlayers,
    uint256 raffleState
);
error Raffle__TransferFailed();

/**
 * @title Sample Raffle Contract
 * @author
 * @notice To create an untamperable, decentralized, totally random smart contract
 * @dev Requires Chainlink VRF & keepers
 */

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum RaffleState {
        OPEN,
        CALCULATING_WINNER
    }

    uint16 private constant REQUEST_CONFIRM_BLOCKS = 3;
    uint32 private constant NUM_WORDS = 1;

    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subId;
    uint32 private immutable i_callbackGasLimit;

    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastBlockTimestamp;
    uint256 private immutable i_interval;

    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subId = subId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        //current block timestamp = block.timestamp
        s_lastBlockTimestamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEntered();
        }

        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpenState();
        }

        s_players.push(payable(msg.sender));

        //emit an event when updating a dynamic arr or mapping, where event is emitted to a data storage outside of smart contract
        //naming convention for event = reverse of function name
        emit RaffleEnter(msg.sender);
    }

    /** 
    @dev func that Chainlink keeper nodes call when checking for upkeepNeeded to return true
        To return true:
        1. time interval should have passed
        2. lottery should have min 1 player and have some eth
        3. subscription to keeper is funded sufficiently with link token
        4. lottery is in a state where random winner is NOT being chosen ("open" state)
    */

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool timePassed = ((block.timestamp - s_lastBlockTimestamp) >
            i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        bool isOpen = (s_raffleState == RaffleState.OPEN);

        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    // performData is generated by the Automation Node's call to checkUpkeep function
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CALCULATING_WINNER;
        //request the rdm no, then do something with it after it is returned
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, //gas lane key hash value, which is the max gas price willing to pay for a request in wei
            i_subId,
            REQUEST_CONFIRM_BLOCKS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastBlockTimestamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getPlayersNo() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastBlockTimestamp;
    }

    function getRequestCfmBlocks() public pure returns (uint256) {
        return REQUEST_CONFIRM_BLOCKS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
