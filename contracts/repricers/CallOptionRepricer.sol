// "SPDX-License-Identifier: GNU General Public License v3.0"

pragma solidity 0.7.6;

import '@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import './IRepricer.sol';
import '../Const.sol';
import '../Num.sol';
import '../NumExtra.sol';

contract CallOptionRepricer is IRepricer, Const, Num, NumExtra {
    int256 public constant NEGATIVE_INFINITY = type(int256).min;

    function isRepricer() external pure override returns (bool) {
        return true;
    }

    function symbol() external pure override returns (string memory) {
        return 'CallOptionRepricer';
    }

    function reprice(
        IVaultMinimal _vault,
        uint256 _pMin,
        int256 _repricerParam1,
        int256 _repricerParam2 //is not used for Call Option
    )
        external
        view
        override
        returns (
            int256 estPricePrimary,
            int256 estPriceComplement,
            uint256 estPrice,
            uint256 upperBoundary
        )
    {
        require(address(_vault) != address(0), 'Zero vault');

        uint8 decimals = AggregatorV3Interface(_vault.oracles(0)).decimals();

        int256 currentUnderlingValue = getCurrentUnderlingValue(_vault) * iBONE;
        int256 iUpperBoundary = max(currentUnderlingValue, int256(mul(_pMin * 10 ** decimals, 2)));

        (estPricePrimary, estPriceComplement) = calcEstPrices(
            calcEstPricePrimary(
                currentUnderlingValue,
                calcTtm(_vault.settleTime()),
                _repricerParam1,
                _vault.underlyingStarts(0)
            ),
            iUpperBoundary,
            int256(_pMin * 10 ** decimals)
        );
        estPrice = uint256((estPriceComplement * iBONE) / estPricePrimary);
        upperBoundary = uint256(iUpperBoundary) / 10 ** decimals;
    }

    function getCurrentUnderlingValue(IVaultMinimal _vault)
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

    function calcEstPricePrimary(
        int256 _spotPrice,
        int256 _ttm,
        int256 _volatility,
        int256 _strike
    ) internal pure returns (int256) {
        int256 ttmSqrt = sqrt(_ttm);
        return calcOption(_spotPrice, _volatility, ttmSqrt, _ttm, _strike);
    }

    function calcOption(
        int256 _spotPrice,
        int256 _volatility,
        int256 _ttmSqrt,
        int256 _ttm,
        int256 _strike
    ) internal pure returns (int256) {
        int256 volatilityBySqrtTtm = (_volatility * _ttmSqrt) / iBONE;
        int256 volatilityByTtm = (((_volatility * _volatility) / iBONE) * _ttm) / (iBONE * 2);

        int256 d =
            (((iBONE * iBONE) / volatilityBySqrtTtm) *
                (ln(_spotPrice / _strike) + volatilityByTtm)) / iBONE;
        return (ncdf(d) * _spotPrice) / iBONE - ncdf(d - volatilityBySqrtTtm) * _strike;
    }

    function calcEstPrices(
        int256 _estPricePrimary,
        int256 _upperBoundary,
        int256 _lowerBoundary
    ) internal pure returns (int256 estPricePrimary, int256 estPriceComplement) {
        estPricePrimary = _estPricePrimary;

        if (estPricePrimary < _lowerBoundary) {
            estPricePrimary = _lowerBoundary;
        }

        if (estPricePrimary > _upperBoundary - _lowerBoundary) {
            estPricePrimary = _upperBoundary - _lowerBoundary;
        }

        estPriceComplement = _upperBoundary - estPricePrimary;
    }

    function sqrtWrapped(int256 x) external pure override returns (int256) {
        return sqrt(x);
    }

    /// @dev Returns the smallest of two numbers
    function max(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }
}
