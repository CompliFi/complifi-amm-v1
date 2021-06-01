// "SPDX-License-Identifier: GNU General Public License v3.0"

pragma solidity 0.7.6;

import '@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import './IRepricer.sol';
import '../Const.sol';
import '../Num.sol';
import '../NumExtra.sol';

//import "hardhat/console.sol";

contract x5Repricer is IRepricer, Const, Num, NumExtra {
    int256 public constant NEGATIVE_INFINITY = type(int256).min;

    function isRepricer() external pure override returns (bool) {
        return true;
    }

    function symbol() external pure override returns (string memory) {
        return 'x5Repricer';
    }

    function reprice(
        uint256 pMin,
        int256 volatility,
        IVault _vault,
        uint256[2] memory primary,
        uint256[2] memory complement,
        int256 _liveUnderlingValue
    )
        external
        view
        override
        returns (
            uint256 newPrimaryLeverage,
            uint256 newComplementLeverage,
            int256 estPricePrimary,
            int256 estPriceComplement
        )
    {
        require(address(_vault) != address(0), 'Zero oracle');

        (estPricePrimary, estPriceComplement) = calcEstPrice(
            calcDenomination(_vault),
            calcUnv(_liveUnderlingValue, getCurrentUnderlingValue(_vault)),
            calcTtm(_vault.settleTime()),
            int256(pMin),
            volatility
        );
        uint256 estPrice = uint256((estPriceComplement * iBONE) / estPricePrimary);

        uint256 leveragesMultiplied = mul(primary[1], complement[1]);

        newPrimaryLeverage = uint256(
            sqrt(int256(div(mul(leveragesMultiplied, mul(complement[0], estPrice)), primary[0])))
        );
        newComplementLeverage = div(leveragesMultiplied, newPrimaryLeverage);
    }

    function getCurrentUnderlingValue(IVault _vault)
        internal
        view
        returns (int256 currentUnderlingValue)
    {
        uint256 currentTimestamp;
        (, currentUnderlingValue, , currentTimestamp, ) = AggregatorV3Interface(_vault.oracles(0))
            .latestRoundData();
        require(currentTimestamp > 0, 'EMPTY_ORACLE_LATEST_ROUND');
    }

    function calcTtm(uint256 _settledTimestamp) internal view returns (int256) {
        return ((int256(_settledTimestamp) - int256(block.timestamp)) * iBONE) / 31536000; // 365 * 24 * 3600
    }

    function calcUnv(int256 _liveUnderlingValue, int256 _currentUnderlingValue)
        internal
        pure
        returns (int256)
    {
        return
            5 *
            iBONE +
            5 *
            (((_currentUnderlingValue - _liveUnderlingValue) * iBONE) / _liveUnderlingValue);
    }

    function calcDenomination(IVault _vault) internal view returns (int256 denomination) {
        denomination = int256(
            _vault.derivativeSpecification().primaryNominalValue() +
                _vault.derivativeSpecification().complementNominalValue()
        );
    }

    function calcEstPricePrimary(
        int256 _unvPrim,
        int256 _ttm,
        int256 _volatility
    ) internal pure returns (int256) {
        int256 volatilityBySqrtTtm = (_volatility * sqrt(_ttm)) / iBONE;
        int256 multiplier = (iBONE * iBONE) / volatilityBySqrtTtm;
        int256 volatilityByTtm = ((_volatility * _volatility) * _ttm) / (iBONE * iBONE * 2);

        int256 d1 = (multiplier * (ln(_unvPrim / 4) + volatilityByTtm)) / iBONE;
        int256 option4 = (ncdf(d1) * _unvPrim) / iBONE - ncdf(d1 - volatilityBySqrtTtm) * 4;

        d1 = (multiplier * (ln(_unvPrim / 6) + volatilityByTtm)) / iBONE;
        int256 option6 = (ncdf(d1) * _unvPrim) / iBONE - ncdf(d1 - volatilityBySqrtTtm) * 6;

        return option4 - option6;
    }

    function calcEstPrice(
        int256 _denomination,
        int256 _unvPrim,
        int256 _ttm,
        int256 _pMin,
        int256 _volatility
    ) internal pure returns (int256 estPricePrimary, int256 estPriceComplement) {
        estPricePrimary = calcEstPricePrimary(_unvPrim, _ttm, _volatility);

        if (estPricePrimary < _pMin) {
            estPricePrimary = _pMin;
        }

        int256 denominationTimesBone = _denomination * iBONE;
        if (estPricePrimary > denominationTimesBone - _pMin) {
            estPricePrimary = denominationTimesBone - _pMin;
        }

        estPriceComplement = denominationTimesBone - estPricePrimary;
    }
}
