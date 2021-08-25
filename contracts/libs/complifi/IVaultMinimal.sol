// "SPDX-License-Identifier: GPL-3.0-or-later"

pragma solidity 0.7.6;

import "./IDerivativeSpecificationMinimal.sol";

interface IVaultMinimal {

    function settleTime() external view returns (uint256);

    function derivativeSpecification()
    external
    view
    returns (IDerivativeSpecificationMinimal);

    function collateralToken() external view returns (address);

    function primaryToken() external view returns (address);

    function complementToken() external view returns (address);

    function underlyingStarts(uint256 index) external view returns (int256);

    function oracles(uint256 index) external view returns (address);
}
