// "SPDX-License-Identifier: GNU General Public License v3.0"

pragma solidity 0.7.6;

import '../libs/complifi/IVault.sol';

interface IRepricer {
    function isRepricer() external pure returns (bool);

    function symbol() external pure returns (string memory);

    function reprice(
        uint256 _pMin,
        int256 _volatility,
        IVault _vault,
        uint256[2] memory _primary,
        uint256[2] memory _complement,
        int256 _liveUnderlingValue
    )
        external
        view
        returns (
            uint256 newPrimaryLeverage,
            uint256 newComplementLeverage,
            int256 estPricePrimary,
            int256 estPriceComplement
        );
}
