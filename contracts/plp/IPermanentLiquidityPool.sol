pragma solidity 0.7.6;

import "../Token.sol";

interface IPermanentLiquidityPool is IERC20 {
    function derivativeSpecification() external view returns (address);
    function designatedPoolRegistry() external view returns (address);

    function designatedPool() external view returns (address);

    function rollOver(
        uint256[] calldata _underlyingEndRoundHints
    )
    external;

    function delegate(uint256 tokenAmount)
    external;

    function delegateTo(address recipient, uint256 tokenAmount)
    external;

    function unDelegate(uint256 tokenAmount)
    external;

    function unDelegateTo(address recipient, uint256 tokenAmount)
    external;
}
