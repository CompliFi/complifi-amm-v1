// "SPDX-License-Identifier: GPL-3.0-or-later"

pragma solidity 0.7.6;

interface IDerivativeSpecificationMinimal {

    function primaryNominalValue() external view returns (uint256);

    function complementNominalValue() external view returns (uint256);

    function symbol() external view returns (string memory);

    function name() external view returns (string memory);
}
