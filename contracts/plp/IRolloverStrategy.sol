pragma solidity 0.7.6;

interface IRolloverStrategy {
    function execute(
        address _poolSettled,
        uint256 _poolAmountIn,
        uint256[] memory _underlyingEndRoundHints,
        address _poolNew
    ) external;
}
